"""Executable security and market guardrail tests without third-party dependencies."""
import sys
import unittest
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent/'backend'))
from core.export_safety import spreadsheet_safe, publishable_count
from core.forecasting import forecast_modal
from core.market_ingestion import parse_observation, InvalidObservation


class V5PureTests(unittest.TestCase):
    def test_csv_injection_dangerous_leaders(self):
        for x in ['=SUM(A1:A2)', '+cmd', '-1+2', '@foo', '\t=HYPERLINK("x")', ' \ufeff=cell', '\r\n=1+1']:
            self.assertTrue(spreadsheet_safe(x).startswith("'"), repr(x))

    def test_non_formula_labels_remain_verbatim(self):
        for x in ['Wheat', 'Punjab', 'A-grade', '1234', ' ', '', 'किसान']:
            self.assertEqual(spreadsheet_safe(x), x)

    def test_small_counts_are_not_published(self):
        self.assertIsNone(publishable_count(0))
        self.assertIsNone(publishable_count(4))
        self.assertEqual(publishable_count(5), 5)
        self.assertEqual(publishable_count(100), 100)

    def test_forecast_never_guesses_on_stale_input(self):
        last = date(2026, 11, 1)
        history = [(last-timedelta(days=(40-i)*3), Decimal(2100+i)) for i in range(41)]
        self.assertEqual(forecast_modal(history,today=last+timedelta(days=8))['status'],'UNAVAILABLE_DATA')

    def test_mandi_parser_never_marks_invalid_band_valid(self):
        row = {'state':'Punjab','district':'Fixture','market':'Fixture Mandi',
               'commodity':'Wheat','arrival_date':'19/11/2026','min_price':2400,
               'modal_price':2200,'max_price':2300}
        data = parse_observation(row,today=date(2026,11,19))
        self.assertEqual(data.quality_status,'FLAGGED')
        self.assertIn('INCONSISTENT_PRICE_BAND',data.flags)

if __name__=='__main__': unittest.main(verbosity=2)
