"""Standard-library tests which can run without third-party packages.

These tests DO NOT replace Django API integration tests.
"""
from datetime import date,timedelta
from decimal import Decimal
from pathlib import Path
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'backend'))
from core.market_ingestion import parse_observation,InvalidObservation
from core.forecasting import forecast_modal
from core.calculations import net_return

TODAY=date(2026,11,19)

def source():
    return dict(commodity='Wheat',market='Bathinda Mandi',district='Bathinda',
        state='Punjab',arrival_date='19/11/2026',variety='Common',grade='FAQ',
        min_price='2000',max_price='2400',modal_price='2200')

class MarketParserTests(unittest.TestCase):
    def test_source_identity_is_case_whitespace_stable(self):
        a=parse_observation(source(),today=TODAY)
        b=parse_observation({**source(),'market':'  BATHINDA  mandi  '},today=TODAY)
        self.assertEqual(a.source_record_id,b.source_record_id)
        self.assertEqual(a.quality_status,'VALID')
    def test_price_band_is_flagged_not_presented_as_valid(self):
        row={**source(),'modal_price':'2900'}
        p=parse_observation(row,today=TODAY)
        self.assertEqual(p.quality_status,'FLAGGED')
        self.assertIn('INCONSISTENT_PRICE_BAND',p.flags)
    def test_wrong_date_and_negative_are_rejected(self):
        for row in ({**source(),'arrival_date':'01/01/2099'},
                    {**source(),'min_price':'-10'},
                    {**source(),'min_price':'NaN'},
                    {**source(),'market':''}):
            with self.subTest(row=row),self.assertRaises(InvalidObservation):
                parse_observation(row,today=TODAY)
    def test_arrivals_require_known_unit(self):
        self.assertIsNone(parse_observation({**source(),'arrival_quantity':'10'},today=TODAY).arrival_qtl)
        converted=parse_observation({**source(),'arrival_quantity':'10','arrival_unit':'tonnes'},today=TODAY)
        self.assertEqual(converted.arrival_qtl,Decimal('100'))
        self.assertEqual(converted.quality_status,'VALID')

class ProjectionTests(unittest.TestCase):
    def test_chronological_holdout(self):
        rows=[(TODAY-timedelta(days=3*(39-i)),Decimal(2200+i)) for i in range(40)]
        output=forecast_modal(rows,today=TODAY)
        self.assertEqual(output['status'],'FORECAST',output)
        self.assertGreaterEqual(output['holdout_samples'],8)
        self.assertEqual(output['target_date'],'2026-11-26')
        self.assertGreaterEqual(output['baseline_mae_inr_per_qtl'],'0.00')
    def test_sparse_and_stale_are_unavailable(self):
        rows=[(TODAY-timedelta(days=3*(39-i)),Decimal(2200+i)) for i in range(40)]
        self.assertEqual(forecast_modal(rows[:8],today=TODAY)['status'],'UNAVAILABLE_DATA')
        self.assertEqual(forecast_modal(rows,today=TODAY+timedelta(days=8))['status'],'UNAVAILABLE_DATA')
    def test_negative_net_return_is_preserved(self):
        self.assertEqual(net_return('2','100',{'transport':'500'})['net_inr'],'-300.00')

if __name__=='__main__':unittest.main(verbosity=2)
