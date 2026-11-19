"""Explainable market-price projection, with chronological seven-day backtesting.

This is statistical market intelligence, *not* a guaranteed future bid. Never
manufacture future observations, use random train/test splits or predict on
missing/stale history. Model choice is based only on past held-out observations.
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from statistics import median

MIN_OBSERVATIONS = 30
MIN_SPAN_DAYS = 60
HORIZON_DAYS = 7
MAX_GAP_DAYS = 21
MONEY = Decimal('0.01')


def _money(value):
    return str(Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP))


def _median(values):
    return Decimal(str(median(values)))


def _estimate(history, candidate, horizon_days=HORIZON_DAYS):
    prices = [p for _, p in history]
    if candidate == 'RECENT':
        return prices[-1]
    if candidate == 'MEDIAN7':
        return _median(prices[-7:])
    # Robust median daily change. Use true elapsed days so sparse/irregular
    # observations cannot masquerade as consecutive daily measurements.
    recent = history[-15:]
    changes = [(b[1]-a[1])/Decimal((b[0]-a[0]).days)
               for a, b in zip(recent, recent[1:])]
    slope = _median(changes)
    # Conservative cap: no trend extrapolation > 2% of latest price per day.
    cap = prices[-1]*Decimal('.02')
    slope = min(cap, max(-cap, slope))
    return max(Decimal(0), _median(prices[-7:]) + slope*Decimal(horizon_days))


def forecast_modal(rows, *, today=None):
    """rows: (date, modal price) for ONE market, crop, grade and variety.

    Forecasts 7 calendar days after the newest observation. Each backtest
    prediction uses ONLY observations on or before target_date-7 days.
    """
    try:
        series=[]
        for day, price in rows:
            val=Decimal(str(price))
            if not isinstance(day, date) or val < 0 or not val.is_finite():
                raise ValueError('Invalid dated price')
            series.append((day, val))
    except (InvalidOperation, ValueError, TypeError):
        return {'status':'UNAVAILABLE_DATA','reason':'History has invalid dates or prices.'}
    series.sort(key=lambda point: point[0])
    if len({d for d,_ in series}) != len(series):
        return {'status':'UNAVAILABLE_DATA','reason':'Multiple prices on a date; filter one variety, grade and data source before forecasting.'}
    if len(series) < MIN_OBSERVATIONS or (series[-1][0]-series[0][0]).days < MIN_SPAN_DAYS:
        return {'status':'UNAVAILABLE_DATA','reason':'At least 30 dated observations across 60 days are required.'}
    if any((b[0]-a[0]).days > MAX_GAP_DAYS for a,b in zip(series,series[1:])):
        return {'status':'UNAVAILABLE_DATA','reason':'History contains a gap longer than 21 days.'}
    today = today or date.today()
    freshness_days = (today-series[-1][0]).days
    if freshness_days < 0 or freshness_days > 7:
        return {'status':'UNAVAILABLE_DATA','reason':'Latest observation must be within seven days.'}

    candidates = ('RECENT','MEDIAN7','TREND')
    errors={name:[] for name in candidates}
    # Genuine seven-CALENDAR-day forecasting backtests, no future leakage.
    for target_day,target_price in series[-min(14,len(series)//4):]:
        cutoff = target_day - timedelta(days=HORIZON_DAYS)
        past = [(d,p) for d,p in series if d <= cutoff]
        if len(past) < 15:
            continue
        for name in candidates:
            predicted = _estimate(past, name, HORIZON_DAYS)
            errors[name].append(abs(target_price-predicted))
    if any(len(values)<8 for values in errors.values()):
        return {'status':'UNAVAILABLE_DATA','reason':'Insufficient independent chronological holdout targets.'}
    mae = {name:sum(values,Decimal(0))/Decimal(len(values)) for name,values in errors.items()}
    best = min(candidates,key=lambda name:(mae[name],candidates.index(name)))
    baseline=mae['RECENT']
    prediction=_estimate(series,best,HORIZON_DAYS)
    # Explicit, uncalibrated heuristic. Wider than empirical one-sided MAE.
    spread=max(Decimal('0.01'),2*mae[best])
    improvement=(baseline-mae[best])/baseline*100 if baseline>0 else Decimal(0)
    method={'RECENT':'Latest observed price persistence',
            'MEDIAN7':'Rolling 7-observation median',
            'TREND':'Capped median daily-trend extrapolation'}[best]
    return {
        'status':'FORECAST','method':method,'model_code':best,
        'horizon_days':HORIZON_DAYS,
        'target_date':(series[-1][0]+timedelta(days=HORIZON_DAYS)).isoformat(),
        'latest_observation_date':series[-1][0].isoformat(),
        'freshness_days':freshness_days,'observations':len(series),
        'history_days':(series[-1][0]-series[0][0]).days,
        'expected_modal_inr_per_qtl':_money(prediction),
        'heuristic_lower_inr_per_qtl':_money(max(Decimal(0),prediction-spread)),
        'heuristic_upper_inr_per_qtl':_money(prediction+spread),
        'holdout_mae_inr_per_qtl':_money(mae[best]),
        'baseline_mae_inr_per_qtl':_money(baseline),
        'relative_holdout_improvement_pct':_money(improvement),
        'holdout_samples':len(errors[best]),
        'candidate_mae_inr_per_qtl':{k:_money(v) for k,v in mae.items()},
        'validation_method':'Walk-forward seven-calendar-day horizon; no shuffled splits',
        'disclaimer':'Historical baseline with chronological validation only; interval is heuristic, not a calibrated or guaranteed price. Do not treat as a firm buyer offer.'
    }
