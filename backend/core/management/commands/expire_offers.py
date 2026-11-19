"""Expire pending offers whose explicit deadlines have passed."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from core.models import Offer
from core.views import notify,log

class Command(BaseCommand):
    help='Expire pending offers after their recorded expiration; idempotent'
    def handle(self,*args,**opts):
        expired=0
        for id in Offer.objects.filter(status='PENDING',expires_at__lte=timezone.now()).values_list('id',flat=True).iterator():
            with transaction.atomic():
                o=Offer.objects.select_for_update().select_related('listing').filter(pk=id,status='PENDING').first()
                if not o or o.expires_at>timezone.now(): continue
                o.status='EXPIRED';o.save(update_fields=['status'])
                notify(o.buyer,'OFFER_EXPIRED',f'Offer {o.pk} has expired')
                notify(o.listing.farmer,'OFFER_EXPIRED',f'Offer {o.pk} has expired')
                log(None,'OFFER_EXPIRED',o.pk)
                expired+=1
        self.stdout.write(f'Expired {expired} offers')
