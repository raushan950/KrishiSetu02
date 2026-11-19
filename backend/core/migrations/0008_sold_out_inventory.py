from django.db import migrations,models
from django.db.models import Q,F

class Migration(migrations.Migration):
    dependencies=[('core','0007_trade_integrity_checks')]
    operations=[
        migrations.RemoveConstraint(model_name='listing',name='valid_inventory'),
        migrations.AddConstraint(model_name='listing',constraint=models.CheckConstraint(
            condition=((Q(quantity_qtl__gt=0)&Q(reserved_qtl__gte=0)&Q(reserved_qtl__lte=F('quantity_qtl'))) |
                       (Q(quantity_qtl=0)&Q(reserved_qtl=0)&Q(status='CLOSED'))),
            name='valid_inventory')),
    ]
