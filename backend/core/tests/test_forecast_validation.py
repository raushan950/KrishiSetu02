from datetime import date,timedelta
from decimal import Decimal
from django.test import SimpleTestCase
from core.forecasting import forecast_modal


class ForecastValidationTests(SimpleTestCase):
    def history(self):
        last=date(2026,10,1)
        return [(last+timedelta(days=3*i),Decimal(2100+i)) for i in range(35)]

    def test_walk_forward_candidates_are_backtested(self):
        records=self.history()
        r=forecast_modal(records,today=records[-1][0])
        self.assertEqual(r['status'],'FORECAST',r)
        self.assertGreaterEqual(r['holdout_samples'],8)
        self.assertEqual(r['horizon_days'],7)
        self.assertEqual(r['validation_method'],'Walk-forward seven-calendar-day horizon; no shuffled splits')
        self.assertEqual(len(r['candidate_mae_inr_per_qtl']),3)

    def test_sparse_stale_and_duplicate_day_refused(self):
        rows=self.history()
        self.assertEqual(forecast_modal(rows[:5],today=rows[-1][0])['status'],'UNAVAILABLE_DATA')
        self.assertEqual(forecast_modal(rows,today=rows[-1][0]+timedelta(days=8))['status'],'UNAVAILABLE_DATA')
        self.assertEqual(forecast_modal(rows+[rows[-1]],today=rows[-1][0])['status'],'UNAVAILABLE_DATA')
        rows[15]=(rows[15][0],Decimal('NaN'))
        self.assertEqual(forecast_modal(rows,today=rows[-1][0])['status'],'UNAVAILABLE_DATA')

    def test_large_observation_gap_is_not_extrapolated(self):
        rows=self.history()
        altered=rows[:25]+[(day+timedelta(days=45),price) for day,price in rows[25:]]
        self.assertEqual(forecast_modal(altered,today=altered[-1][0])['status'],'UNAVAILABLE_DATA')
