"""Environment-independent checks (NOT Django integration tests)."""
from pathlib import Path
from datetime import date,timedelta
from decimal import Decimal
import json,sys,re

root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'backend'))
from core.calculations import net_return
from core.forecasting import forecast_modal

checks=0
def assert_check(cond,what):
 global checks
 assert cond,what
 checks+=1

x=net_return('20','2500',{'transport':'1500','loading':'500'},'2')
assert_check(x['gross_inr']=='49000.00','gross')
assert_check(x['net_inr']=='47000.00','net')
assert_check(x['net_per_qtl_inr']=='2350.00','per qtl')
assert_check(x['net_per_kg_inr']=='23.50','per kg')
y=net_return('1','500',{'transport':'900'},'0')
assert_check(y['net_inr']=='-400.00','negative return must remain negative')
for vals in [('-1','100',{},'0'),('1','-1',{},'0'),('1','100',{},'101'),('1','100',{'unknown':'50'},'0'),('NaN','100',{},'0')]:
 try: net_return(*vals)
 except ValueError: assert_check(True,'invalid rejected')
 else: raise AssertionError('Invalid calculation accepted')
observations=[(date(2024,1,1)+timedelta(days=3*i),Decimal(2000+i)) for i in range(50)]
f=forecast_modal(observations,today=observations[-1][0])
assert_check(f['status']=='FORECAST','forecast sufficient history')
assert_check(f['observations']==50,'observations preserved')
assert_check(forecast_modal(observations[:5])['status']=='UNAVAILABLE_DATA','forecast insufficient history')
assert_check('heuristic' in f['disclaimer'],'forecast uncertainty label')
api=(root/'backend/core/urls.py').read_text()
for route in ['orders/<uuid:pk>/accept-delivery/','order-changes/','disputes/','refunds/','auth/email-change/request/',
              'assistant/guided/','analytics/history/','routing/road/','admin/review-queue/','market/coverage/','admin/import-monitor/','shipments/<int:pk>/events/']:
 assert_check(route in api,f'api path {route}')
for fname in ['0001_initial.py','0002_price_alert_payments.py','0003_trade_resolution.py','0004_email_change.py','0005_market_import_monitoring.py','0006_shipment_event.py','0007_trade_integrity_checks.py','0008_sold_out_inventory.py']:
 assert_check((root/'backend/core/migrations'/fname).is_file(),f'migration {fname}')
assert_check('no-reply@' in (root/'backend/config/settings.py').read_text(),'email config')
assert_check('RAZORPAY_WEBHOOK_SECRET' in (root/'.env.example').read_text(),'payment key env')
assert_check('ORS_API_KEY' in (root/'.env.example').read_text(),'road env')
assert_check('MARKET_LLM_PROVIDER' in (root/'.env.example').read_text(),'LLM env')
print(f'PASS: {checks} standalone checks (calculations, forecasts, route manifest and config); NOT API execution')
