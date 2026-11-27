"""Executable Django tests: real ORM required. Source fixtures are not market data."""
from datetime import timedelta
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock,patch

from django.core.management import call_command
from django.test import TestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import User, MandiPrice, MarketImportRun


def fixture_record(*, market='Fixture Mandi A', price=2400):
    return {'state':'Punjab','district':'Example District','market':market,
        'commodity':'Wheat','variety':'Unspecified','grade':'FAQ',
        'arrival_date':timezone.localdate().strftime('%d/%m/%Y'),
        'min_price':price-100,'max_price':price+100,'modal_price':price}


class MandiImporterTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.admin=User.objects.create_superuser('mandi-admin@example.org','Strong#Admin619')

    @override_settings(OGD_API_KEY='not-a-real-test-key',OGD_RESOURCE_ID='test-resource')
    @patch('core.management.commands.import_ogd.requests.get')
    def test_real_response_paging_idempotency_and_provenance(self, get):
        a,b=fixture_record(),fixture_record(market='Fixture Mandi B',price=2300)
        get.side_effect=[Mock(**{'json.return_value':{'records':[a],'total':2}}),
                         Mock(**{'json.return_value':{'records':[b],'total':2}})]
        call_command('import_ogd', limit=1, all_pages=True, max_pages=4)
        run=MarketImportRun.objects.latest('id')
        self.assertEqual((run.status,run.received_count,run.created_count,run.pages_count),('SUCCESS',2,2,2))
        self.assertEqual(MandiPrice.objects.filter(quality_status='VALID').count(),2)
        self.assertTrue(all(p.source=='OGD/AGMARKNET' for p in MandiPrice.objects.all()))
        get.reset_mock()
        get.side_effect = None
        get.return_value = Mock(**{'json.return_value': {'records': [a, b], 'total': 2}})
        call_command('import_ogd', limit=500)
        self.assertEqual(MarketImportRun.objects.latest('id').unchanged_count,2)
        self.assertEqual(MandiPrice.objects.count(),2)

    def test_unverified_local_file_never_appears_in_public_prices(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'observations.json'
            path.write_text(json.dumps({'records':[fixture_record(),
                fixture_record(market='Suspicious Price Mandi',price=1100001),
                {**fixture_record(market='Invalid Future Mandi'),'arrival_date':'01/01/2099'}]}))
            call_command('import_ogd',file=str(path))
        run=MarketImportRun.objects.latest('id')
        self.assertEqual(run.created_count,2)
        self.assertEqual(run.invalid_count,1)
        self.assertEqual(run.flagged_count,2)
        self.assertEqual(MandiPrice.objects.filter(quality_status='VALID').count(),0)
        self.assertIn('UNVERIFIED_LOCAL_FILE',MandiPrice.objects.first().quality_flags)
        self.assertEqual(self.client.get('/api/v1/prices/').data['count'],0)

    def test_ingestion_monitor_is_admin_only(self):
        other=User.objects.create_user('non-admin@example.org','Strong#Farmer991',role='FARMER')
        self.client.force_authenticate(user=other)
        self.assertEqual(self.client.get('/api/v1/admin/import-monitor/').status_code,403)
        self.client.force_authenticate(user=self.admin)
        data=self.client.get('/api/v1/admin/import-monitor/')
        self.assertEqual(data.status_code,200)
        self.assertIn('runs',data.data)

    @override_settings(OGD_API_KEY='test-key',OGD_RESOURCE_ID='test-resource')
    @patch('core.management.commands.import_ogd.requests.get')
    def test_bad_provider_payload_is_visible_as_failed_run(self, get):
        from django.core.management.base import CommandError
        get.return_value=Mock(**{'json.return_value':{'records':'wrong-type'}})
        with self.assertRaises(CommandError):
            call_command('import_ogd')
        self.assertEqual(MarketImportRun.objects.latest('id').status,'FAILED')
