from django.db import migrations,models
from django.db.models import F,Q

class Migration(migrations.Migration):
    dependencies=[('core','0006_shipment_event')]
    operations=[
        migrations.AddConstraint(model_name='offer',constraint=models.CheckConstraint(
            condition=Q(quantity_qtl__gt=0)&Q(price_per_qtl__gt=0),name='positive_offer_amounts')),
        migrations.AddConstraint(model_name='order',constraint=models.CheckConstraint(
            condition=Q(quantity_qtl__gt=0)&Q(accepted_qtl__gte=0)&Q(cancelled_qtl__gte=0)&Q(returned_qtl__gte=0)&
                Q(accepted_qtl__lte=F('quantity_qtl')-F('cancelled_qtl'))&Q(returned_qtl__lte=F('accepted_qtl')),
            name='valid_order_quantities')),
        migrations.AddConstraint(model_name='vehicle',constraint=models.CheckConstraint(
            condition=Q(capacity_qtl__gt=0),name='positive_vehicle_capacity')),
        migrations.AddConstraint(model_name='freightquote',constraint=models.CheckConstraint(
            condition=Q(price_inr__gt=0),name='positive_freight_price')),
    ]
