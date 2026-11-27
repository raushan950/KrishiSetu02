"""Idempotent ingestion with source provenance, paging and observability.

Nothing is imported unless a real API response or explicitly supplied JSON file
exists. Local JSON files remain flagged as unverified data, not live prices.
"""
import json
import time
from pathlib import Path
from decimal import Decimal,ROUND_HALF_UP

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.market_ingestion import InvalidObservation, parse_observation
from core.models import Crop, Market, MandiPrice, MarketImportRun


class Command(BaseCommand):
    help = 'Import OGD market observations with validation and a visible run log'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=500)
        parser.add_argument('--offset', type=int, default=0)
        parser.add_argument('--all', action='store_true', dest='all_pages')
        parser.add_argument('--max-pages', type=int, default=20)
        parser.add_argument('--file', type=str, default='', help='Offline OGD-format JSON; always flagged as unverified')

    def _page(self, offset, limit):
        url = f'https://api.data.gov.in/resource/{settings.OGD_RESOURCE_ID}'
        for attempt in range(3):
            try:
                response = requests.get(url,
                    params={'api-key': settings.OGD_API_KEY, 'format': 'json',
                            'limit': limit, 'offset': offset},
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KrishiSetu/5.1'},
                    timeout=60)
                response.raise_for_status()
                return response.json()
            except (requests.RequestException, ValueError) as exc:
                if attempt == 2:
                    raise CommandError(f'Government data API unavailable: {type(exc).__name__}') from exc
                time.sleep(min(2**attempt, 4))

    def _process_record(self, raw, run, source):
        try:
            parsed = parse_observation(raw, today=timezone.localdate())
        except InvalidObservation:
            run.invalid_count += 1
            return
        with transaction.atomic():
            crop, _ = Crop.objects.get_or_create(name=parsed.crop)
            market, _ = Market.objects.get_or_create(
                name=parsed.market, district=parsed.district, state=parsed.state)
            flags = list(parsed.flags)
            earlier = (MandiPrice.objects.filter(crop=crop,market=market,
                variety=parsed.variety,grade=parsed.grade,
                observed_on__lt=parsed.observed_on,quality_status='VALID')
                .order_by('-observed_on').first())
            if (earlier and (parsed.observed_on-earlier.observed_on).days<=14
                and earlier.modal_price>0 and parsed.modal_price>0
                and (parsed.modal_price>earlier.modal_price*3
                    or parsed.modal_price*3<earlier.modal_price)):
                flags.append('LARGE_RELATIVE_PRICE_CHANGE')
            cents=Decimal('0.01')
            defaults = {
                'crop': crop, 'market': market, 'variety': parsed.variety,
                'grade': parsed.grade, 'observed_on': parsed.observed_on,
                'min_price': parsed.min_price.quantize(cents,rounding=ROUND_HALF_UP),
                'max_price': parsed.max_price.quantize(cents,rounding=ROUND_HALF_UP),
                'modal_price': parsed.modal_price.quantize(cents,rounding=ROUND_HALF_UP),
                'arrival_qtl': parsed.arrival_qtl.quantize(Decimal('0.001'),rounding=ROUND_HALF_UP) if parsed.arrival_qtl is not None else None,
                'unit': 'INR/quintal', 'quality_status':
                    'FLAGGED' if source == 'UNVERIFIED_FILE' or flags else 'VALID',
                'quality_flags': (['UNVERIFIED_LOCAL_FILE'] if source == 'UNVERIFIED_FILE' else [])
                                 + flags,
            }
            existing = MandiPrice.objects.filter(
                source=source, source_record_id=parsed.source_record_id).first()
            if existing is None:
                MandiPrice.objects.create(source=source,
                    source_record_id=parsed.source_record_id, **defaults)
                run.created_count += 1
            elif any(getattr(existing, k) != v for k, v in defaults.items()):
                for key, val in defaults.items():
                    setattr(existing, key, val)
                existing.save(update_fields=[*defaults, 'imported_at'])
                run.updated_count += 1
            else:
                run.unchanged_count += 1
            if source == 'UNVERIFIED_FILE' or flags:
                run.flagged_count += 1

    def handle(self, *args, **options):
        limit, offset, max_pages = options['limit'], options['offset'], options['max_pages']
        if not (1 <= limit <= 5000 and 0 <= offset and 1 <= max_pages <= 1000):
            raise CommandError('limit must be 1–5000, offset nonnegative, max-pages 1–1000')
        from_file = bool(options['file'])
        if not from_file and (not settings.OGD_API_KEY or not settings.OGD_RESOURCE_ID):
            raise CommandError('OGD_API_KEY and OGD_RESOURCE_ID are required for API ingestion')
        source = 'UNVERIFIED_FILE' if from_file else 'OGD/AGMARKNET'
        run = MarketImportRun.objects.create(
            source=source, resource_id='local-json-unverified' if from_file else settings.OGD_RESOURCE_ID,
            status='RUNNING')
        try:
            if from_file:
                payload = json.loads(Path(options['file']).read_text(encoding='utf-8'))
                if isinstance(payload, list):
                    payload = {'records': payload}
                pages = [payload]
            else:
                pages = None
            for page_index in range(1 if from_file else (max_pages if options['all_pages'] else 1)):
                payload = pages[page_index] if from_file else self._page(offset, limit)
                if not isinstance(payload, dict) or not isinstance(payload.get('records'), list):
                    raise CommandError('Source JSON requires a records array')
                records = payload['records']
                run.pages_count += 1
                for record in records:
                    run.received_count += 1
                    self._process_record(record, run, source)
                if from_file or len(records) < limit:
                    break
                offset += len(records)
                total = payload.get('total')
                if str(total).isdigit() and offset >= int(total):
                    break
            run.status = 'SUCCESS'
        except Exception as exc:
            run.status = 'FAILED'
            run.error = type(exc).__name__  # no API keys or provider payload in durable logs
            raise CommandError(f'Import failed (run #{run.pk}): {type(exc).__name__}') from exc
        finally:
            run.finished_at = timezone.now()
            run.save()
            self.stdout.write(f'Import #{run.pk}: {run.status}; {run.received_count} records; '
                f'{run.created_count} created, {run.updated_count} updated, '
                f'{run.unchanged_count} unchanged, {run.invalid_count} invalid, '
                f'{run.flagged_count} flagged across {run.pages_count} pages')
