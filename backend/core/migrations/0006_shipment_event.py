from django.db import migrations,models
import django.db.models.deletion
import core.storage

class Migration(migrations.Migration):
    dependencies=[('core','0005_market_import_monitoring')]
    operations=[
        migrations.CreateModel(name='ShipmentEvent',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('status',models.CharField(max_length=14,choices=[('ASSIGNED','Assigned'),('PICKED_UP','Picked up'),('IN_TRANSIT','In transit'),('DELIVERED','Delivered')])),
            ('note',models.CharField(blank=True,max_length=1000)),
            ('evidence',models.ImageField(blank=True,storage=core.storage.PrivateEvidenceStorage(),upload_to='shipment_evidence/%Y/%m/%d/')),
            ('recorded_at',models.DateTimeField(auto_now_add=True)),
            ('actor',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,to='core.user')),
            ('shipment',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name='events',to='core.shipment')),
        ],options={'indexes':[models.Index(fields=['shipment','recorded_at'],name='shipment_event_timeline_idx')],
                  'constraints':[models.UniqueConstraint(fields=['shipment','status'],name='unique_shipment_milestone')]})
    ]
