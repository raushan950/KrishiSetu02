from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q

class Migration(migrations.Migration):
    dependencies=[('core','0001_initial')]
    operations=[
        migrations.CreateModel(name='PriceAlert',fields=[
            ('id',models.BigAutoField(primary_key=True,serialize=False,auto_created=True,verbose_name='ID')),
            ('threshold_per_qtl',models.DecimalField(max_digits=13,decimal_places=2)),
            ('direction',models.CharField(max_length=5,choices=[('ABOVE','At or above'),('BELOW','At or below')])),
            ('enabled',models.BooleanField(default=True)),
            ('created_at',models.DateTimeField(auto_now_add=True)),
            ('crop',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,to='core.crop')),
            ('market',models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.CASCADE,to='core.market')),
            ('owner',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='price_alerts',to='core.user')),
            ('last_notified_price',models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.SET_NULL,to='core.mandiprice')),
        ]),
        migrations.AddConstraint(model_name='pricealert',constraint=models.CheckConstraint(condition=Q(threshold_per_qtl__gt=0),name='positive_alert_threshold')),
        migrations.CreateModel(name='PaymentAttempt',fields=[
            ('id',models.BigAutoField(primary_key=True,serialize=False,auto_created=True,verbose_name='ID')),
            ('gateway_order_id',models.CharField(max_length=100,unique=True)),
            ('gateway_payment_id',models.CharField(max_length=100,blank=True)),
            ('amount_paise',models.PositiveBigIntegerField()),
            ('currency',models.CharField(max_length=3,default='INR')),
            ('status',models.CharField(max_length=10,choices=[('INITIATED','Created with gateway'),('CALLBACK','Signed callback received, awaiting gateway confirmation'),('CAPTURED','Gateway-confirmed captured payment'),('FAILED','Gateway-reported failure')],default='INITIATED')),
            ('initiated_at',models.DateTimeField(auto_now_add=True)),
            ('updated_at',models.DateTimeField(auto_now=True)),
            ('confirmed_at',models.DateTimeField(blank=True,null=True)),
            ('order',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name='payment_attempts',to='core.order')),
        ]),
        migrations.AddConstraint(model_name='paymentattempt',constraint=models.CheckConstraint(condition=Q(amount_paise__gt=0),name='positive_payment_amount')),
        migrations.CreateModel(name='PaymentWebhookEvent',fields=[
            ('id',models.BigAutoField(primary_key=True,serialize=False,auto_created=True,verbose_name='ID')),
            ('gateway_event_id',models.CharField(max_length=128,unique=True)),
            ('event_name',models.CharField(max_length=80)),
            ('body_sha256',models.CharField(max_length=64)),
            ('processed_at',models.DateTimeField(auto_now_add=True)),
        ]),
    ]
