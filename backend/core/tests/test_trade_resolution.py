"""API contract and authorization regressions for inventory, dispute and refunds.

Django/PostgreSQL must execute these cases in CI; source existence is NOT a pass.
"""
import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock,patch

from django.test import TestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (User,Crop,Listing,Offer,Order,PaymentAttempt,RefundRequest,
                         OrderChangeRequest,DeliveryAcceptance,TradeDispute,Settlement,Vehicle)


@override_settings(DEBUG=True,EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class TradingResolutionTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.farmer=User.objects.create_user('trader-farmer@example.org','Secure#Farmer991',role='FARMER',
            phone='+919876543310',email_verified=True,phone_verified=True)
        self.buyer=User.objects.create_user('trader-buyer@example.org','Secure#Buyer991',role='BUYER',
            phone='+919876543311',email_verified=True,phone_verified=True)
        self.other=User.objects.create_user('trader-other@example.org','Secure#Other991',role='BUYER',
            phone='+919876543312',email_verified=True,phone_verified=True)
        self.admin=User.objects.create_superuser('trader-admin@example.org','Secure#Admin991')
        self.crop=Crop.objects.create(name='Test Barley')
        self.listing=Listing.objects.create(farmer=self.farmer,crop=self.crop,quantity_qtl=Decimal('10'),
            reserved_qtl=Decimal('0'),asking_per_qtl=Decimal('2000'),district='Test',state='Punjab')
        self.offer=Offer.objects.create(listing=self.listing,buyer=self.buyer,proposed_by=self.buyer,
            quantity_qtl=Decimal('4'),price_per_qtl=Decimal('2000'),expires_at=timezone.now()+timedelta(days=2))
        self.auth(self.farmer)
        result=self.client.post(f'/api/v1/offers/{self.offer.pk}/accept/')
        self.assertEqual(result.status_code,201,result.data)
        self.order=Order.objects.get(pk=result.data['id'])
    def auth(self,user): self.client.force_authenticate(user=user)
    def accept_one(self):
        self.auth(self.buyer)
        return self.client.post(f'/api/v1/orders/{self.order.id}/accept-delivery/',{
            'quantity_qtl':'1.000','farmgate_handover_confirmed':True,'evidence_note':'Buyer manually verified 1 qtl'},format='json')

    def test_buyer_acceptance_consumes_only_accepted_inventory(self):
        self.auth(self.farmer)
        forbidden=self.client.post(f'/api/v1/orders/{self.order.id}/accept-delivery/',{
            'quantity_qtl':'1','farmgate_handover_confirmed':True},format='json')
        self.assertEqual(forbidden.status_code,403)
        self.auth(self.buyer)
        missing=self.client.post(f'/api/v1/orders/{self.order.id}/accept-delivery/',{
            'quantity_qtl':'1'},format='json')
        self.assertEqual(missing.status_code,400)
        good=self.accept_one()
        self.assertEqual(good.status_code,201,good.data)
        self.order.refresh_from_db();self.listing.refresh_from_db()
        self.assertEqual(self.order.accepted_qtl,Decimal('1'))
        self.assertEqual(self.listing.quantity_qtl,Decimal('9'))
        self.assertEqual(self.listing.reserved_qtl,Decimal('3'))
        self.assertEqual(self.order.status,'PARTIALLY_FULFILLED')
        too_much=self.client.post(f'/api/v1/orders/{self.order.id}/accept-delivery/',{
            'quantity_qtl':'4','farmgate_handover_confirmed':True},format='json')
        self.assertEqual(too_much.status_code,400)
        self.assertEqual(DeliveryAcceptance.objects.count(),1)

    def test_two_party_cancellation_of_unaccepted_remainder(self):
        self.assertEqual(self.accept_one().status_code,201)
        request=self.client.post('/api/v1/order-changes/',{
            'order':str(self.order.id),'kind':'CANCEL_REMAINDER','quantity_qtl':'3',
            'reason':'Remaining 3 quintals are no longer required'},format='json')
        self.assertEqual(request.status_code,201,request.data)
        change_id=request.data['id']
        self.assertEqual(self.client.post(f'/api/v1/order-changes/{change_id}/respond/',{
            'decision':'APPROVE'},format='json').status_code,403)
        self.auth(self.farmer)
        approved=self.client.post(f'/api/v1/order-changes/{change_id}/respond/',{'decision':'APPROVE'},format='json')
        self.assertEqual(approved.status_code,200,approved.data)
        self.order.refresh_from_db();self.listing.refresh_from_db()
        self.assertEqual(self.order.cancelled_qtl,Decimal('3'))
        self.assertEqual(self.listing.quantity_qtl,Decimal('9'))
        self.assertEqual(self.listing.reserved_qtl,Decimal('0'))
        self.assertEqual(OrderChangeRequest.objects.get(pk=change_id).status,'APPROVED')
        self.auth(self.buyer)
        self.assertEqual(self.client.post(f'/api/v1/order-changes/{change_id}/respond/',{
            'decision':'REJECT'},format='json').status_code,400)

    def test_return_does_not_automatically_restock_or_refund(self):
        self.assertEqual(self.accept_one().status_code,201)
        self.auth(self.buyer)
        r=self.client.post('/api/v1/order-changes/',{
            'order':str(self.order.id),'kind':'RETURN','quantity_qtl':'1',
            'reason':'Produce grade differed from agreement'},format='json')
        self.assertEqual(r.status_code,201)
        self.auth(self.farmer)
        response=self.client.post(f"/api/v1/order-changes/{r.data['id']}/respond/",{'decision':'APPROVE'},format='json')
        self.assertEqual(response.status_code,200)
        self.order.refresh_from_db();self.listing.refresh_from_db()
        self.assertEqual(self.order.returned_qtl,Decimal('1'))
        self.assertEqual(self.listing.quantity_qtl,Decimal('9'))
        self.assertEqual(self.order.status,'RETURNED')
        self.assertFalse(RefundRequest.objects.exists())

    def test_dispute_freezes_receipt_and_admin_unfreezes_without_money_movement(self):
        self.auth(self.buyer)
        opened=self.client.post('/api/v1/disputes/',{'order':str(self.order.id),
            'category':'PAYMENT','description':'Invoice and agreed payment conditions do not match'},format='json')
        self.assertEqual(opened.status_code,201,opened.data)
        denied=self.client.post(f'/api/v1/orders/{self.order.id}/accept-delivery/',{
            'quantity_qtl':'1','farmgate_handover_confirmed':True},format='json')
        self.assertEqual(denied.status_code,400)
        self.auth(self.other)
        self.assertEqual(self.client.post(f"/api/v1/disputes/{opened.data['id']}/resolve/",{
            'decision':'RESOLVE','resolution_note':'Reviewed invoices and recorded agreement'},format='json').status_code,403)
        self.auth(self.admin)
        resolved=self.client.post(f"/api/v1/disputes/{opened.data['id']}/resolve/",{
            'decision':'RESOLVE','resolution_note':'Reviewed invoices and recorded agreement'},format='json')
        self.assertEqual(resolved.status_code,200,resolved.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status,'CONFIRMED')
        self.assertEqual(TradeDispute.objects.get(pk=opened.data['id']).status,'RESOLVED')

    def test_manual_settlement_requires_delivery_acceptance_and_counterparty(self):
        self.auth(self.buyer)
        not_yet=self.client.post('/api/v1/settlements/',{
            'order':str(self.order.id),'amount_inr':'8000','reference':'BANK123'},format='json')
        self.assertEqual(not_yet.status_code,400)
        accepted=self.client.post(f'/api/v1/orders/{self.order.id}/accept-delivery/',{
            'quantity_qtl':'4','farmgate_handover_confirmed':True},format='json')
        self.assertEqual(accepted.status_code,201)
        declared=self.client.post('/api/v1/settlements/',{
            'order':str(self.order.id),'amount_inr':'8000','reference':'BANK123'},format='json')
        self.assertEqual(declared.status_code,201,declared.data)
        settlement_id=declared.data['id']
        self.assertEqual(self.client.post(f'/api/v1/settlements/{settlement_id}/acknowledge/',{
            'acknowledge':True},format='json').status_code,403)
        self.auth(self.farmer)
        done=self.client.post(f'/api/v1/settlements/{settlement_id}/acknowledge/',{
            'acknowledge':True},format='json')
        self.assertEqual(done.status_code,200)
        self.assertEqual(Settlement.objects.get(pk=settlement_id).status,'RECONCILED')

    def test_listing_edit_cannot_reduce_below_reserved_and_other_user_cannot_edit(self):
        self.auth(self.other)
        self.assertEqual(self.client.patch(f'/api/v1/listings/{self.listing.pk}/',{
            'asking_per_qtl':'3000'},format='json').status_code,403)
        self.auth(self.farmer)
        self.assertEqual(self.client.patch(f'/api/v1/listings/{self.listing.pk}/',{
            'quantity_qtl':'3'},format='json').status_code,400)
        okay=self.client.patch(f'/api/v1/listings/{self.listing.pk}/',{'asking_per_qtl':'2100'},format='json')
        self.assertEqual(okay.status_code,200)

    @override_settings(RAZORPAY_KEY_ID='rzp_test_fake',RAZORPAY_KEY_SECRET='test-secret',RAZORPAY_WEBHOOK_SECRET='hook-secret')
    @patch('core.trade_resolution.requests.post')
    def test_refund_requires_captured_money_and_signed_webhook(self,post):
        attempt=PaymentAttempt.objects.create(order=self.order,gateway_order_id='order_refund_test',
            gateway_payment_id='pay_refund_test',amount_paise=800000,status='CAPTURED')
        self.auth(self.buyer)
        requested=self.client.post('/api/v1/refunds/',{
            'payment':attempt.pk,'amount_paise':100000,'reason':'Agreed return of a smaller quantity'},format='json')
        self.assertEqual(requested.status_code,201,requested.data)
        rid=requested.data['id']
        over=self.client.post('/api/v1/refunds/',{
            'payment':attempt.pk,'amount_paise':750000,'reason':'Over the remaining eligible refund balance'},format='json')
        self.assertEqual(over.status_code,400)
        self.auth(self.admin)
        response=Mock();response.json.return_value={'id':'rfnd_krishi_test','payment_id':'pay_refund_test',
            'amount':100000,'status':'pending'}
        post.return_value=response
        submitted=self.client.post(f'/api/v1/refunds/{rid}/review/',{'decision':'SUBMIT'},format='json')
        self.assertEqual(submitted.status_code,200,submitted.data)
        self.assertEqual(RefundRequest.objects.get(pk=rid).status,'PROVIDER_PENDING')
        self.assertEqual(self.client.post(f'/api/v1/refunds/{rid}/review/',{'decision':'SUBMIT'},format='json').status_code,400)
        self.client.force_authenticate(user=None)
        payload=json.dumps({'event':'refund.processed','payload':{'refund':{'entity':{
            'id':'rfnd_krishi_test','payment_id':'pay_refund_test','amount':100000,'status':'processed'}}}}).encode()
        sig=hmac.new(b'hook-secret',payload,hashlib.sha256).hexdigest()
        bad=self.client.post('/api/v1/payments/webhook/',payload,content_type='application/json',
            HTTP_X_RAZORPAY_EVENT_ID='refundevt_bad',HTTP_X_RAZORPAY_SIGNATURE='nope')
        self.assertEqual(bad.status_code,403)
        good=self.client.post('/api/v1/payments/webhook/',payload,content_type='application/json',
            HTTP_X_RAZORPAY_EVENT_ID='refundevt_good',HTTP_X_RAZORPAY_SIGNATURE=sig)
        self.assertEqual(good.status_code,200,good.data)
        self.assertEqual(RefundRequest.objects.get(pk=rid).status,'PROCESSED')

    def test_admin_vehicle_approval_requires_evidence_review(self):
        transporter=User.objects.create_user('trader-transport@example.org','Secure#Transport991',
            role='TRANSPORTER',phone='+919876543314',email_verified=True,phone_verified=True)
        vehicle=Vehicle.objects.create(transporter=transporter,registration='PB00DEMO0099',
            vehicle_type='truck',capacity_qtl=10)
        self.auth(self.buyer)
        self.assertEqual(self.client.post(f'/api/v1/admin/vehicles/{vehicle.pk}/verify/',{
            'verified':True,'evidence_note':'Reviewed registration certificate'},format='json').status_code,403)
        self.auth(self.admin)
        self.assertEqual(self.client.post(f'/api/v1/admin/vehicles/{vehicle.pk}/verify/',{'verified':True},format='json').status_code,400)
        success=self.client.post(f'/api/v1/admin/vehicles/{vehicle.pk}/verify/',{
            'verified':True,'evidence_note':'Reviewed registration certificate'},format='json')
        self.assertEqual(success.status_code,200)
        vehicle.refresh_from_db();self.assertTrue(vehicle.verified)

    def test_non_admin_cannot_export_institutional_csv(self):
        self.auth(self.farmer)
        self.assertEqual(self.client.get('/api/v1/institutional/analytics.csv').status_code,403)
        self.auth(self.admin)
        response=self.client.get('/api/v1/institutional/analytics.csv')
        self.assertEqual(response.status_code,200)
        self.assertIn('text/csv',response['Content-Type'])
