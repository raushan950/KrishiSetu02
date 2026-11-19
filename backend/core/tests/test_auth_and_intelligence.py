"""Account recovery and provenance/routing test source. Requires Django runtime."""
from decimal import Decimal
from datetime import timedelta
from urllib.parse import urlparse,parse_qs
from unittest.mock import Mock,patch

from django.core import mail
from django.test import TestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import User,EmailChangeChallenge,Crop,Market,MandiPrice,Farm


@override_settings(DEBUG=True,EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class EmailChangeTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.user=User.objects.create_user('previous-email@example.org','Secure#Previous123',role='FARMER',
            phone='+919876543410',email_verified=True,phone_verified=True,google_sub='google-previous-test')
        self.client.force_authenticate(user=self.user)
    def request_change(self):
        return self.client.post('/api/v1/auth/email-change/request/',{
            'current_password':'Secure#Previous123','new_email':'verified-new@example.org'},format='json')
    def test_requires_password_and_new_mailbox_proof(self):
        wrong=self.client.post('/api/v1/auth/email-change/request/',{
            'current_password':'wrong','new_email':'verified-new@example.org'},format='json')
        self.assertEqual(wrong.status_code,400)
        response=self.request_change()
        self.assertEqual(response.status_code,200,response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email,'previous-email@example.org')
        self.assertEqual(EmailChangeChallenge.objects.filter(user=self.user).count(),1)
        self.assertEqual(len(mail.outbox),1)
        link=mail.outbox[-1].body.split('Open this single-use link (valid for 30 minutes): ')[1].strip()
        query=parse_qs(urlparse(link).query)
        r=self.client.post('/api/v1/auth/email-change/confirm/',{
            'challenge_id':query['email_change_id'][0],
            'token':query['email_change_token'][0]},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email,'verified-new@example.org')
        self.assertTrue(self.user.email_verified)
        self.assertIsNone(self.user.google_sub)
        replay=self.client.post('/api/v1/auth/email-change/confirm/',{
            'challenge_id':query['email_change_id'][0],
            'token':query['email_change_token'][0]},format='json')
        self.assertEqual(replay.status_code,400)
    def test_verification_token_is_not_stored_plaintext(self):
        self.assertEqual(self.request_change().status_code,200)
        challenge=EmailChangeChallenge.objects.get(user=self.user)
        self.assertEqual(len(challenge.digest),64)
        self.assertNotIn(challenge.digest,mail.outbox[0].body)


@override_settings(DEBUG=True)
class MarketIntelligenceTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.crop=Crop.objects.create(name='Test Chickpeas')
        self.market=Market.objects.create(name='Test Market',district='Test District',state='Punjab',
            latitude=Decimal('31.2000000'),longitude=Decimal('75.5000000'))
        self.farmer=User.objects.create_user('routing@example.org','Secure#Routing123',role='FARMER',
            phone='+919876543411',email_verified=True,phone_verified=True)
        self.farm=Farm.objects.create(farmer=self.farmer,name='Family farm',district='Test',state='Punjab',
            latitude=Decimal('31.1000000'),longitude=Decimal('75.4000000'))
    def test_history_unavailable_is_explicit(self):
        response=self.client.get(f'/api/v1/analytics/history/?crop={self.crop.pk}&market={self.market.pk}')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.data['status'],'UNAVAILABLE_DATA')
        self.assertEqual(response.data['count'],0)
    def test_history_preserves_individual_sources(self):
        p=MandiPrice.objects.create(market=self.market,crop=self.crop,source='TEST_FIXTURE_NOT_LIVE',
            source_record_id='history-1',observed_on=timezone.localdate()-timedelta(days=2),
            min_price=900,max_price=1100,modal_price=1000)
        r=self.client.get(f'/api/v1/analytics/history/?crop={self.crop.pk}&market={self.market.pk}')
        self.assertEqual(r.data['status'],'HISTORICAL_DATA')
        self.assertEqual(r.data['observations'][0]['source_record_id'],p.source_record_id)
    def test_assistant_requires_real_observations(self):
        self.client.force_authenticate(user=self.farmer)
        r=self.client.post('/api/v1/assistant/guided/',{'crop_id':self.crop.pk},format='json')
        self.assertEqual(r.data['status'],'UNAVAILABLE_DATA')
        MandiPrice.objects.create(market=self.market,crop=self.crop,source='TEST_FIXTURE_NOT_LIVE',
            source_record_id='assistant-1',observed_on=timezone.localdate(),min_price=1200,max_price=1400,modal_price=1300)
        guided=self.client.post('/api/v1/assistant/guided/',{
            'crop_id':self.crop.pk,'quantity_qtl':'10','question':'Where to sell?',
            'costs_by_market':{str(self.market.pk):{'costs':{'transport':'500'}}}},format='json')
        self.assertEqual(guided.status_code,200,guided.data)
        self.assertEqual(guided.data['ranked'][0]['calculation']['net_inr'],'12500.00')
        self.assertEqual(guided.data['sources'][0]['source'],'TEST_FIXTURE_NOT_LIVE')
    @override_settings(ORS_API_KEY='sandbox-example-key')
    @patch('core.intelligence.requests.post')
    def test_road_distance_comes_from_provider_not_haversine(self,post):
        fake=Mock();fake.json.return_value={'features':[{'properties':{'summary':{'distance':23123.45,'duration':4000}}}]}
        post.return_value=fake
        self.client.force_authenticate(user=self.farmer)
        r=self.client.post('/api/v1/routing/road/',{'farm_id':self.farm.pk,'market_id':self.market.pk},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data['distance_km'],'23.12')
        self.assertEqual(r.data['source'],'openrouteservice')
        self.assertEqual(post.call_args.kwargs['json']['coordinates'],[[75.4,31.1],[75.5,31.2]])
    def test_road_unavailable_without_provider(self):
        self.client.force_authenticate(user=self.farmer)
        r=self.client.post('/api/v1/routing/road/',{'farm_id':self.farm.pk,'market_id':self.market.pk},format='json')
        self.assertEqual(r.status_code,503)
