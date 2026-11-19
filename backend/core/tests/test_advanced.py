"""Regression cases. Run against real PostgreSQL in CI for transactional tests."""
import hashlib
import hmac
import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.core.management import call_command
from django.test import TestCase,SimpleTestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.forecasting import forecast_modal
from core.payment import checkout_signature_ok,webhook_signature_ok,amount_in_paise
from core.models import (User,Crop,Market,MandiPrice,Listing,Offer,Order,
                         VerificationChallenge,PriceAlert,Notification,PaymentAttempt,PaymentWebhookEvent)
from core.security import create_challenge,consume_challenge
from rest_framework.exceptions import ValidationError


class ForecastUnitTests(SimpleTestCase):
    def test_unavailable_without_sufficient_history(self):
        self.assertEqual(forecast_modal([(date(2026,1,1),Decimal(1200))])['status'],'UNAVAILABLE_DATA')

    def test_chronological_holdout_and_transparent_interval(self):
        rows=[(date(2025,1,1)+timedelta(days=3*i),Decimal(2200+i)) for i in range(40)]
        result=forecast_modal(rows,today=rows[-1][0])
        self.assertEqual(result['status'],'FORECAST')
        self.assertEqual(result['observations'],40)
        self.assertEqual(result['target_date'],(rows[-1][0]+timedelta(days=7)).isoformat())
        self.assertIn('heuristic',result['disclaimer'])

    @override_settings(RAZORPAY_KEY_SECRET='example-secret',RAZORPAY_WEBHOOK_SECRET='webhook-secret')
    def test_signatures_are_based_on_raw_gateway_data(self):
        sig=hmac.new(b'example-secret',b'order_test|pay_test',hashlib.sha256).hexdigest()
        self.assertTrue(checkout_signature_ok('order_test','pay_test',sig))
        self.assertFalse(checkout_signature_ok('order_test','pay_wrong',sig))
        raw=b'{"event":"payment.captured"}'
        hook=hmac.new(b'webhook-secret',raw,hashlib.sha256).hexdigest()
        self.assertTrue(webhook_signature_ok(raw,hook))
        self.assertFalse(webhook_signature_ok(raw+b' ',hook))

    def test_money_to_paise_half_up(self):
        self.assertEqual(amount_in_paise('2.5','2000'),500000)
        self.assertEqual(amount_in_paise('1','0.005'),1)


@override_settings(DEBUG=True,EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class AdvancedApiTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.farmer=User.objects.create_user('alerts-farmer@example.org','Password#Farmer88',
            role='FARMER',phone='+919876543110',email_verified=True,phone_verified=True)
        self.buyer=User.objects.create_user('alerts-buyer@example.org','Password#Buyer88',
            role='BUYER',phone='+919876543111',email_verified=True,phone_verified=True)
        self.crop=Crop.objects.create(name='Mustard')
        self.market=Market.objects.create(name='Verified Fixture Mandi',district='Test District',state='Punjab')
        self.price=MandiPrice.objects.create(crop=self.crop,market=self.market,source='TEST_FIXTURE_NOT_LIVE',
            source_record_id='test-alert',observed_on=timezone.localdate(),
            min_price=2000,max_price=2300,modal_price=2200)
        self.listing=Listing.objects.create(farmer=self.farmer,crop=self.crop,
            quantity_qtl='3.0',asking_per_qtl='2200',district='Test District',state='Punjab')

    def test_verification_bad_attempts_are_persisted_and_locked(self):
        challenge=create_challenge(self.farmer,'EMAIL')
        for attempt in range(5):
            with self.assertRaises(ValidationError):
                consume_challenge(self.farmer,challenge.id,'incorrect-token','EMAIL')
            challenge.refresh_from_db()
            self.assertEqual(challenge.attempts,attempt+1)
        with self.assertRaises(ValidationError):
            consume_challenge(self.farmer,challenge.id,'anything','EMAIL')
        self.assertFalse(challenge.used_at)

    def test_alert_fires_once_for_source_backed_price(self):
        self.client.force_authenticate(user=self.farmer)
        reply=self.client.post('/api/v1/price-alerts/',{'crop':self.crop.id,'direction':'ABOVE',
            'threshold_per_qtl':'2100'},format='json')
        self.assertEqual(reply.status_code,201)
        call_command('evaluate_price_alerts')
        self.assertEqual(Notification.objects.filter(recipient=self.farmer,category='PRICE_ALERT').count(),1)
        call_command('evaluate_price_alerts')
        self.assertEqual(Notification.objects.filter(recipient=self.farmer,category='PRICE_ALERT').count(),1)
        self.assertEqual(self.client.delete(f"/api/v1/price-alerts/{reply.data['id']}/").status_code,204)

    def test_forecast_returns_unavailable_for_sparse_records(self):
        reply=self.client.get(f'/api/v1/forecast/?crop={self.crop.pk}&market={self.market.pk}')
        self.assertEqual(reply.status_code,200)
        self.assertEqual(reply.data['status'],'UNAVAILABLE_DATA')

    @override_settings(RAZORPAY_KEY_ID='rzp_test_example',RAZORPAY_KEY_SECRET='key-secret',RAZORPAY_WEBHOOK_SECRET='hook-secret')
    @patch('core.views.create_gateway_order',return_value='order_test_abcdef')
    def test_gateway_callback_never_marks_captured_until_signed_webhook(self,gateway_create):
        offer=Offer.objects.create(listing=self.listing,buyer=self.buyer,proposed_by=self.buyer,
            quantity_qtl='2',price_per_qtl='2200',expires_at=timezone.now()+timedelta(days=2))
        order=Order.objects.create(offer=offer,listing=self.listing,farmer=self.farmer,
            buyer=self.buyer,quantity_qtl='2',price_per_qtl='2200')
        self.client.force_authenticate(user=self.buyer)
        init=self.client.post('/api/v1/payments/initiate/',{'order':str(order.id)},format='json')
        self.assertEqual(init.status_code,201)
        gateway_create.assert_called_once()
        attempt=PaymentAttempt.objects.get(order=order)
        self.assertEqual(attempt.amount_paise,440000)
        self.assertEqual(attempt.status,'INITIATED')
        signature=hmac.new(b'key-secret',b'order_test_abcdef|pay_test_1',hashlib.sha256).hexdigest()
        callback=self.client.post('/api/v1/payments/confirm/',{
            'razorpay_order_id':'order_test_abcdef','razorpay_payment_id':'pay_test_1',
            'razorpay_signature':signature},format='json')
        self.assertEqual(callback.status_code,200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status,'CALLBACK')
        self.client.force_authenticate(user=None)
        payload=json.dumps({'event':'payment.captured','payload':{'payment':{'entity':{
            'id':'pay_test_1','order_id':'order_test_abcdef','status':'captured',
            'currency':'INR','amount':440000}}}}).encode()
        headers={'HTTP_X_RAZORPAY_EVENT_ID':'evt_001','HTTP_X_RAZORPAY_SIGNATURE':
                 hmac.new(b'hook-secret',payload,hashlib.sha256).hexdigest()}
        invalid=self.client.post('/api/v1/payments/webhook/',payload,content_type='application/json',
                                 HTTP_X_RAZORPAY_EVENT_ID='evt_invalid',HTTP_X_RAZORPAY_SIGNATURE='bad')
        self.assertEqual(invalid.status_code,403)
        self.assertEqual(PaymentWebhookEvent.objects.count(),0)
        valid=self.client.post('/api/v1/payments/webhook/',payload,content_type='application/json',**headers)
        self.assertEqual(valid.status_code,200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status,'CAPTURED')
        repeat=self.client.post('/api/v1/payments/webhook/',payload,content_type='application/json',**headers)
        self.assertEqual(repeat.data['status'],'ALREADY_PROCESSED')
        self.assertEqual(PaymentWebhookEvent.objects.count(),1)
        self.assertEqual(Notification.objects.filter(category='PAYMENT').count(),2)

    def test_no_gateway_credentials_does_not_create_payment_records(self):
        offer=Offer.objects.create(listing=self.listing,buyer=self.buyer,proposed_by=self.buyer,
            quantity_qtl='1',price_per_qtl='2200',expires_at=timezone.now()+timedelta(days=2))
        order=Order.objects.create(offer=offer,listing=self.listing,farmer=self.farmer,buyer=self.buyer,
            quantity_qtl='1',price_per_qtl='2200')
        self.client.force_authenticate(user=self.buyer)
        r=self.client.post('/api/v1/payments/initiate/',{'order':str(order.pk)},format='json')
        self.assertEqual(r.status_code,503)
        self.assertEqual(PaymentAttempt.objects.count(),0)
