"""Deterministic crop revenue calculations. All monetary amounts in INR."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

COST_FIELDS = ('transport','loading','unloading','labour','market_fees','commission',
               'taxes','packaging','handling','other')
CENT = Decimal('0.01')

def dec(value, field, *, positive=False):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'{field} must be a decimal number')
    if not result.is_finite() or (positive and result <= 0) or (not positive and result < 0):
        raise ValueError(f'{field} must be {"greater than" if positive else "at least"} zero')
    return result

def net_return(quantity_qtl, price_per_qtl, costs, loss_percent='0'):
    qty = dec(quantity_qtl,'quantity_qtl',positive=True)
    price = dec(price_per_qtl,'price_per_qtl')
    loss = dec(loss_percent,'loss_percent')
    if loss > 100: raise ValueError('loss_percent cannot exceed 100')
    if not isinstance(costs,dict) or set(costs).difference(COST_FIELDS):
        raise ValueError('costs must be a mapping with recognized cost keys')
    clean = {name:dec(costs.get(name,0),name) for name in COST_FIELDS}
    sale_qty = qty*(Decimal('100')-loss)/Decimal('100')
    gross = (sale_qty*price).quantize(CENT, rounding=ROUND_HALF_UP)
    total = sum(clean.values(), Decimal(0)).quantize(CENT,rounding=ROUND_HALF_UP)
    net = gross-total
    def money(d): return str(d.quantize(CENT, rounding=ROUND_HALF_UP))
    return {
        'unit':'INR', 'quantity_unit':'quintal', 'quantity_qtl':str(qty),
        'saleable_qtl':str(sale_qty), 'price_per_qtl':money(price),
        'gross_inr':money(gross), 'total_deductions_inr':money(total),
        'net_inr':money(net), 'net_per_qtl_inr':money(net/qty),
        'net_per_kg_inr':money(net/(qty*100)),
        'cost_breakdown_inr':{k:money(v) for k,v in clean.items()},
        'loss_percent':str(loss), 'basis':'User supplied prices and costs, not guaranteed income',
    }
