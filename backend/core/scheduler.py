"""Automated background scheduler for periodic mandi price synchronization.

Runs periodic ingestion from the Government of India OGD (Agmarknet) API
and evaluates price alerts in a dedicated daemon thread.
"""
import logging
import os
import sys
import threading
import time

from django.conf import settings
from django.core.management import call_command

logger = logging.getLogger(__name__)

_SCHEDULER_THREAD = None
_SYNC_LOCK = threading.Lock()
_IS_SYNCING = False


def execute_sync(limit=None, max_pages=None):
    """Execute a single ingestion run and evaluate alerts."""
    global _IS_SYNCING
    if not _SYNC_LOCK.acquire(blocking=False):
        logger.info("Mandi sync is already running in another thread, skipping.")
        return False

    _IS_SYNCING = True
    try:
        if not getattr(settings, 'OGD_API_KEY', '') or not getattr(settings, 'OGD_RESOURCE_ID', ''):
            logger.warning("Auto-sync skipped: OGD_API_KEY or OGD_RESOURCE_ID not configured.")
            return False

        page_size = limit or getattr(settings, 'OGD_IMPORT_PAGE_SIZE', 500)
        pages = max_pages or getattr(settings, 'OGD_IMPORT_MAX_PAGES', 5)

        logger.info("Starting automated mandi sync: limit=%s, max_pages=%s", page_size, pages)
        call_command('import_ogd', all_pages=True, limit=page_size, max_pages=pages)
        call_command('evaluate_price_alerts')
        logger.info("Automated mandi sync and alert evaluation completed successfully.")
        return True
    except Exception as exc:
        logger.error("Automated mandi sync failed: %s", exc, exc_info=True)
        return False
    finally:
        _IS_SYNCING = False
        _SYNC_LOCK.release()


def sync_now_in_background(limit=250, max_pages=5):
    """Spawn an on-demand background sync thread."""
    if _IS_SYNCING:
        return False
    t = threading.Thread(target=execute_sync, args=(limit, max_pages), daemon=True, name="KrishiSetu-ManualSync")
    t.start()
    return True


def _scheduler_loop():
    """Background worker loop that runs periodically."""
    # Let server finish boot and connection pool warm up
    time.sleep(15)
    logger.info("KrishiSetu Mandi Auto-Sync daemon active.")

    # Run one sync shortly after startup
    execute_sync(limit=100, max_pages=3)

    interval = int(os.getenv('OGD_SYNC_INTERVAL_SECONDS', '14400'))  # Default 4 hours
    while True:
        time.sleep(interval)
        execute_sync()


def start_scheduler():
    """Start the periodic background scheduler if appropriate for current environment."""
    global _SCHEDULER_THREAD

    if _SCHEDULER_THREAD and _SCHEDULER_THREAD.is_alive():
        return

    # Only start when running as a web server
    is_server = any('runserver' in arg or 'gunicorn' in arg or 'uvicorn' in arg for arg in sys.argv)
    if not is_server and os.getenv('FORCE_SCHEDULER') != '1':
        return

    # Skip during migrations, tests, shell commands
    for arg in sys.argv:
        if any(cmd in arg for cmd in ('migrate', 'makemigrations', 'test', 'pytest', 'check', 'collectstatic', 'seed_crops', 'import_ogd')):
            return
    if 'pytest' in sys.modules:
        return

    # Under Django runserver autoreloader, run only in the main worker child process
    if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
        return

    if os.getenv('ENABLE_AUTO_SYNC', '1') != '1':
        logger.info("Mandi auto-sync disabled by ENABLE_AUTO_SYNC=0.")
        return

    _SCHEDULER_THREAD = threading.Thread(target=_scheduler_loop, daemon=True, name="KrishiSetu-AutoSyncDaemon")
    _SCHEDULER_THREAD.start()
    logger.info("KrishiSetu background mandi sync scheduler thread started.")
