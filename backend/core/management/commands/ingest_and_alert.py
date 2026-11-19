"""Scheduled entrypoint: full bounded real-source import, then deduped alerts."""
from django.conf import settings
from django.core.management.base import BaseCommand,call_command

class Command(BaseCommand):
    help='Ingest configured OGD price pages and only then evaluate alerts'
    def handle(self,*args,**kwargs):
        call_command('import_ogd',all_pages=True,
            limit=settings.OGD_IMPORT_PAGE_SIZE,max_pages=settings.OGD_IMPORT_MAX_PAGES)
        call_command('evaluate_price_alerts')
