"""Evaluate notification subscriptions against newly imported market observations.

Run after successful ingestion through a scheduler; deduplicated by observation ID.
"""
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from core.models import PriceAlert, MandiPrice, Notification


class Command(BaseCommand):
    help='Generate in-app price alerts for source-backed latest mandi prices'

    def handle(self,*args,**kwargs):
        sent=0
        for alert in PriceAlert.objects.filter(enabled=True).select_related('crop','market').iterator():
            qs=MandiPrice.objects.filter(crop_id=alert.crop_id,quality_status='VALID',observed_on__lte=timezone.localdate(),observed_on__gte=timezone.localdate()-timedelta(days=2))
            if alert.market_id: qs=qs.filter(market_id=alert.market_id)
            observation=qs.order_by('-observed_on','-id').first()
            if not observation or observation.pk==alert.last_notified_price_id:
                continue
            crossed=(observation.modal_price>=alert.threshold_per_qtl if alert.direction=='ABOVE'
                     else observation.modal_price<=alert.threshold_per_qtl)
            if not crossed:
                continue
            with transaction.atomic():
                locked=PriceAlert.objects.select_for_update().get(pk=alert.pk)
                if not locked.enabled or locked.last_notified_price_id==observation.pk: continue
                Notification.objects.create(recipient=alert.owner,category='PRICE_ALERT',
                    message=(f'{alert.crop.name}: observed modal ₹{observation.modal_price}/qtl on '
                             f'{observation.observed_on} from {observation.source} (market #{observation.market_id}).'))
                locked.last_notified_price=observation
                locked.save(update_fields=['last_notified_price'])
                sent+=1
        self.stdout.write(self.style.SUCCESS(f'Created {sent} price alert notification(s)'))
