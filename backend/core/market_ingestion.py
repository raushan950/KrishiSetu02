"""Pure, testable OGD/AGMARKNET record normalizer (no network or Django dependencies).

Source data is observational, not a firm agricultural bid. Records without
usable units or provenance are never silently converted into live prices.
"""
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import re


class InvalidObservation(ValueError):
    pass


@dataclass(frozen=True)
class NormalizedObservation:
    crop: str
    market: str
    district: str
    state: str
    variety: str
    grade: str
    observed_on: date
    min_price: Decimal
    max_price: Decimal
    modal_price: Decimal
    arrival_qtl: Decimal | None
    source_record_id: str
    quality_status: str
    flags: tuple[str, ...]


def _text(row, key, maximum):
    value = str(row.get(key) or '').strip()
    value = re.sub(r'\s+', ' ', value)
    if len(value) > maximum:
        raise InvalidObservation(f'{key} exceeds {maximum} characters')
    return value


def _number(value, key):
    try:
        number = Decimal(str(value).strip().replace(',', ''))
    except (InvalidOperation, TypeError, AttributeError, ValueError):
        raise InvalidObservation(f'{key} is not numeric')
    if not number.is_finite() or number < 0:
        raise InvalidObservation(f'{key} must be finite and nonnegative')
    return number


def _date(raw, today):
    if isinstance(raw, date) and not isinstance(raw, datetime):
        observed = raw
    else:
        observed = None
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
            try:
                observed = datetime.strptime(str(raw).strip(), fmt).date()
                break
            except (ValueError, TypeError):
                pass
    if observed is None or observed.year < 2000 or observed > today:
        raise InvalidObservation('arrival_date is invalid or in the future')
    return observed


def _arrival(row):
    """Only convert arrivals when the source states an unambiguous unit."""
    raw = row.get('arrival_quantity', row.get('arrival_qty', row.get('arrival_qtl')))
    if raw in (None, ''):
        return None, ()
    count = _number(raw, 'arrival_quantity')
    unit = str(row.get('arrival_unit') or row.get('arrival_quantity_unit') or '').strip().lower()
    units = {'quintal': Decimal(1), 'quintals': Decimal(1), 'qtl': Decimal(1),
             'q': Decimal(1), 'kg': Decimal('.01'), 'kilogram': Decimal('.01'),
             'tonne': Decimal(10), 'tonnes': Decimal(10), 'metric ton': Decimal(10),
             'metric tonnes': Decimal(10)}
    if not unit and row.get('arrival_qtl') not in (None, ''):
        unit = 'qtl'
    if unit not in units:
        return None, ('UNKNOWN_ARRIVAL_UNIT',)
    return count * units[unit], ()


def parse_observation(row, *, today=None):
    """Validate a real provider record and flag suspicious values for review.

    Prices are assumed to be INR/quintal *only* for a configured OGD resource
    documenting those units. Callers must not use this parser to certify other
    arbitrary source formats or externally sourced price units.
    """
    if not isinstance(row, dict):
        raise InvalidObservation('Observation must be an object')
    today = today or date.today()
    fields = {k: _text(row, k, m) for k, m in (
        ('commodity', 100), ('market', 140), ('district', 120), ('state', 120),
        ('variety', 100), ('grade', 80))}
    if not all(fields[k] for k in ('commodity', 'market', 'district', 'state')):
        raise InvalidObservation('Commodity, market, district and state are required')
    observed = _date(row.get('arrival_date'), today)
    low, high, modal = (_number(row.get(k), k) for k in ('min_price', 'max_price', 'modal_price'))
    arrival_qtl, arrival_flags = _arrival(row)
    flags = list(arrival_flags)
    if not low <= modal <= high:
        flags.append('INCONSISTENT_PRICE_BAND')
    if any(p == 0 for p in (low, high, modal)):
        flags.append('ZERO_PRICE_REQUIRES_REVIEW')
    if any(p > Decimal('1000000') for p in (low, high, modal)):
        flags.append('EXTREME_PRICE_REQUIRES_REVIEW')
    identifier = '|'.join([fields[k].casefold() for k in ('state', 'district', 'market',
                               'commodity', 'variety', 'grade')] + [observed.isoformat()])
    return NormalizedObservation(
        crop=fields['commodity'], market=fields['market'], district=fields['district'],
        state=fields['state'], variety=fields['variety'], grade=fields['grade'],
        observed_on=observed, min_price=low, max_price=high, modal_price=modal,
        arrival_qtl=arrival_qtl, source_record_id=sha256(identifier.encode('utf8')).hexdigest(),
        quality_status='FLAGGED' if flags else 'VALID', flags=tuple(flags))
