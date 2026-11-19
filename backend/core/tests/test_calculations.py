from decimal import Decimal
from django.test import SimpleTestCase
from core.calculations import net_return

class NetReturnTests(SimpleTestCase):
    def test_correct_units_and_costs(self):
        r=net_return('20','2500',{'transport':'1500','commission':'500'},'5')
        self.assertEqual(r['saleable_qtl'],'19')
        self.assertEqual(r['gross_inr'],'47500.00')
        self.assertEqual(r['total_deductions_inr'],'2000.00')
        self.assertEqual(r['net_inr'],'45500.00')
        self.assertEqual(r['net_per_qtl_inr'],'2275.00')
        self.assertEqual(r['net_per_kg_inr'],'22.75')

    def test_negative_net_is_not_clamped(self):
        self.assertEqual(net_return('1','100',{'transport':'400'})['net_inr'],'-300.00')

    def test_rejects_non_finite_or_invalid_inputs(self):
        for args in [(0,'100',{}),('NaN','100',{}),('1','Infinity',{}),('1','100',{},'101')]:
            with self.subTest(args=args),self.assertRaises(ValueError):net_return(*args)
        with self.assertRaises(ValueError):net_return('1','100',{'made_up_fee':'3'})

    def test_decimal_precision(self):
        r=net_return('3','0.10',{'loading':'0.10'})
        self.assertEqual(Decimal(r['net_inr']), Decimal('0.20'))
