from django.db import migrations,models


class Migration(migrations.Migration):
    dependencies=[('core','0004_email_change')]
    operations=[
        migrations.AddField(model_name='mandiprice',name='quality_flags',
            field=models.JSONField(default=list,blank=True)),
        migrations.CreateModel(name='MarketImportRun',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('source',models.CharField(max_length=60)),
            ('resource_id',models.CharField(max_length=140)),
            ('status',models.CharField(max_length=10,default='RUNNING',choices=[('RUNNING','Running'),('SUCCESS','Success'),('FAILED','Failed')])),
            ('started_at',models.DateTimeField(auto_now_add=True)),
            ('finished_at',models.DateTimeField(blank=True,null=True)),
            ('pages_count',models.PositiveIntegerField(default=0)),
            ('received_count',models.PositiveIntegerField(default=0)),
            ('created_count',models.PositiveIntegerField(default=0)),
            ('updated_count',models.PositiveIntegerField(default=0)),
            ('unchanged_count',models.PositiveIntegerField(default=0)),
            ('invalid_count',models.PositiveIntegerField(default=0)),
            ('flagged_count',models.PositiveIntegerField(default=0)),
            ('error',models.CharField(blank=True,max_length=400)),
        ],options={'indexes':[models.Index(fields=['-started_at'],name='market_import_started_idx')]})
    ]
