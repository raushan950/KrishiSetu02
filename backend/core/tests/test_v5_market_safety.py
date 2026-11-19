"""Regression coverage for source comparison, stale-market guardrails and aggregate privacy.

Requires Django + PostgreSQL or suitable test database; do not claim these
pass unless the full Django suite has actually been run.
"""
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import Crop, Market, MandiPrice, User


class ProfileAndStalenessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.crop = Crop.objects.create(name='Source-specific mustard fixture')
        self.market = Market.objects.create(name='Fixture Mandi', district='Example', state='Punjab')
        self.farmer = User.objects.create_user('market-fixture@example.org', 'Secure#Fixture121', role='FARMER')
        self.client.force_authenticate(user=self.farmer)

    def add_price(self, *, name, grade='A', days_ago=1, price=2100, source='TEST_OBSERVATION'):
        return MandiPrice.objects.create(crop=self.crop, market=self.market, variety='Variety X',
            grade=grade, observed_on=timezone.localdate()-timedelta(days=days_ago),
            min_price=Decimal(price)-100, max_price=Decimal(price)+100,
            modal_price=Decimal(price), source=source, source_record_id=name)

    def test_mixed_grades_do_not_create_a_single_market_history_or_recommendation(self):
        self.add_price(name='a', grade='A')
        self.add_price(name='b', grade='B', price=4000)
        history = self.client.get('/api/v1/analytics/history/', {
            'crop': self.crop.id, 'market': self.market.id})
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data['status'], 'PROFILE_SELECTION_REQUIRED')
        self.assertEqual(history.data['count'], 0)
        assistant = self.client.post('/api/v1/assistant/guided/', {
            'crop_id': self.crop.id, 'quantity_qtl': '10',
            'costs_by_market': {str(self.market.id): {'costs': {'transport': '200'}}}}, format='json')
        self.assertEqual(assistant.status_code, 200)
        self.assertEqual(assistant.data['status'], 'PROFILE_SELECTION_REQUIRED')
        self.assertEqual(assistant.data['ranked'], [])
        chosen = self.client.post('/api/v1/assistant/guided/', {
            'crop_id': self.crop.id, 'variety': 'Variety X', 'grade': 'A',
            'source': 'TEST_OBSERVATION', 'quantity_qtl': '10',
            'costs_by_market': {str(self.market.id): {'costs': {'transport': '200'}}}}, format='json')
        self.assertEqual(chosen.status_code, 200)
        self.assertEqual(chosen.data['ranked'][0]['calculation']['net_inr'], '20800.00')
        profile_history = self.client.get('/api/v1/analytics/history/', {
            'crop': self.crop.id, 'market': self.market.id, 'variety': 'Variety X',
            'grade': 'A', 'source': 'TEST_OBSERVATION'})
        self.assertEqual(profile_history.data['status'], 'HISTORICAL_DATA')
        self.assertEqual(profile_history.data['count'], 1)

    def test_stale_market_does_not_receive_positive_net_return_recommendation(self):
        self.add_price(name='old-a', days_ago=30)
        r = self.client.post('/api/v1/assistant/guided/', {
            'crop_id': self.crop.id, 'quantity_qtl': '10',
            'costs_by_market': {str(self.market.id): {'costs': {'transport': '0'}}}}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'HISTORICAL_DATA')
        self.assertEqual(r.data['ranked'], [])
        self.assertEqual(r.data['sources'][0]['freshness_days'], 30)

    def test_invalid_profile_filter_is_rejected(self):
        self.add_price(name='one')
        response = self.client.post('/api/v1/assistant/guided/', {
            'crop_id': self.crop.id, 'source': 'x'*101}, format='json')
        self.assertEqual(response.status_code, 400)


class AggregatePrivacyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.inst = User.objects.create_user('inst-example@example.org', 'Secure#Institute421', role='INSTITUTION')
        self.client.force_authenticate(user=self.inst)
        self.crop = Crop.objects.create(name='Privacy fixture crop')
        self.market = Market.objects.create(name='Privacy fixture market', district='District', state='Punjab')

    def add_price(self, i):
        MandiPrice.objects.create(crop=self.crop, market=self.market, variety='A',grade='G',
            observed_on=timezone.localdate()-timedelta(days=i), source='TEST_NOT_LIVE',
            source_record_id=f'privacy-{i}', min_price=1000,max_price=1100,modal_price=1050)

    def test_small_population_aggregate_is_suppressed_in_api_and_csv(self):
        self.add_price(0)
        self.add_price(1)
        data = self.client.get('/api/v1/institutional/analytics/')
        self.assertEqual(data.status_code, 200)
        self.assertEqual(data.data['aggregated_market_prices'], [])
        self.assertIsNone(data.data['users_total'])
        csv = self.client.get('/api/v1/institutional/analytics.csv')
        self.assertEqual(csv.status_code, 200)
        self.assertNotIn('Privacy fixture crop', csv.content.decode())

    def test_group_published_after_minimum_observation_count(self):
        for i in range(5): self.add_price(i)
        data = self.client.get('/api/v1/institutional/analytics/')
        self.assertEqual(len(data.data['aggregated_market_prices']), 1)
        self.assertEqual(data.data['aggregated_market_prices'][0]['observations'], 5)
        csv = self.client.get('/api/v1/institutional/analytics.csv')
        self.assertIn('Privacy fixture crop', csv.content.decode())
