from django.db import migrations,models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies=[('core','0003_trade_resolution')]
    operations=[
        migrations.CreateModel(name='EmailChangeChallenge',fields=[
            ('id',models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False,serialize=False)),
            ('new_email',models.EmailField(max_length=254)),
            ('digest',models.CharField(max_length=64)),
            ('expires_at',models.DateTimeField()),
            ('created_at',models.DateTimeField(auto_now_add=True)),
            ('used_at',models.DateTimeField(null=True,blank=True)),
            ('attempts',models.PositiveSmallIntegerField(default=0)),
            ('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='email_changes',to='core.user'))
        ]),
        migrations.AddIndex(model_name='emailchangechallenge',index=models.Index(fields=['user','created_at'],name='core_emchg_user_created_idx'))
    ]
