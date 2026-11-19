# KrishiSetu v4 — focused engineering additions (19 Nov 2026)

This document distinguishes implemented source code from functionality verified by execution. It supplements the original master-prompt matrix; it does **not** assert complete government readiness or deployment.

## 1. Mandi market intelligence

**Implemented:**
- `core/market_ingestion.py`: independent OGD-format record normalizer, explicit dates, decimal prices, canonical deduplication keys, nonnegative finite numbers, price-band checks, impossible-date rejection, optional arrival conversion **only with known units**, and suspicious-price flags.
- `import_ogd`: bounded multi-page real OGD importer, retries, per-run evidence, create/update/no-change/invalid/flagged counters, row-level idempotency, configurable OGD source and pagination. A local file can be imported for inspection **but is always flagged as `UNVERIFIED_FILE` and excluded** from recommendations, prices and forecasts.
- Relative price changes >3x an observed prior price within 14 days are flagged for review, not silently presented as valid. This threshold is a conservative screening heuristic, not an agricultural price truth or calibrated anomaly detector.
- `MarketImportRun` persistence and admin-only `/api/v1/admin/import-monitor/`. `MandiPrice.quality_flags` stores review causes.
- `/api/v1/market/coverage/` reports latest dates per observed crop/market. `/api/v1/market/opportunities/` displays only recent, valid market options and a farmer's eligible pending offers.
- Destination ranking and user interface now use the **same** recent market data filter and optional geographic/variety/grade filters. Old data cannot silently win a current recommendation. Cost inputs are never fabricated.
- Bounded scheduled full paging in `ingest_and_alert` (instead of only one page).

**Needs external validation:** OGD API key/resource access, live schema and rate-limit/usage review, authoritative data quality checks, provider freshness SLAs, a real historical archive. Official catalog: https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi . Do not treat any record as guaranteed executable trade price.

## 2. Trading and inventory

**Implemented/strengthened:**
- Existing verified accounts, listings, offers, counters, atomic order inventory reservations, delivery acceptance, two-party cancellation/returns, dispute records, settlement acknowledgements and refund states are retained.
- Counteroffer acceptance now rechecks expiry **inside** the transaction.
- Database constraints enforce positive offer quantities/prices, nonnegative order quantities, returned quantity not exceeding accepted quantity, and accepted+cancelled quantity not exceeding ordered quantity.
- Sold-out inventory **can** reach zero only if reserved quantity is zero and listing status is `CLOSED` (the previous check constraint blocked an otherwise valid final delivery).
- Unit/regression tests added for completed 100% deliveries and trading invariants.

**Needs external validation:** real PostgreSQL transactional race tests, operational dispute/refund rules, independent buyer/supplier identity vetting, physical commodity grading and fulfillment checks, payment-rail reconciliation.

## 3. Transport and logistics

**Implemented/strengthened:**
- Per-order freight requests and verified vehicle quotations are retained; quote prices and vehicle capacities have positive database constraints.
- Assignment verifies vehicle ownership and sufficient capacity again, locks the vehicle row, rejects competing **active** assignments for the same pickup date and creates an audit milestone.
- Shipment progression is enforced server-side: `ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED`. Each immutable `ShipmentEvent` records actor, timestamp, note and optional private evidence file. A transporter cannot skip a milestone or read another carrier's shipment.
- Delivery requires a descriptive note or photo, but remains only a carrier declaration until buyer acceptance. Images are validated (JPEG/PNG/WebP, <=5MB), stored under `PRIVATE_MEDIA_ROOT` and downloaded only through authorized API endpoints. Docker provides a separate persistent private volume.
- Buyer/seller and transporter UI show the event timeline; the transporter UI now asks for actual evidence rather than auto-filling a claim.

**Needs external validation:** real carrier verification, insurance and dispatch regulations, road routing and GPS with consent, scanning and private object-storage provider, vehicle availability beyond same-day conflict rules, real logistics service levels.

## 4. Forecasting and AI intelligence

**Implemented/strengthened:**
- Deterministic, explainable **7-calendar-day** forecast candidates: last-observation persistence, 7-observation median and capped median daily trend.
- Model is selected by chronological **walk-forward 7-day holdout MAE**, without shuffled train/test sets or future information. Returns baseline error, candidate errors, selected method, number of holdout targets, and explicitly *heuristic*, non-calibrated interval.
- Forecast refuses fewer than 30 observations/60-day span, repeated dates, gaps >21 days, nonfinite prices, observations older than 7 days, or mixed grade/variety/source histories. UI supports selecting a specific historical profile when several exist.
- Existing assistant remains source-grounded; optional LLM output is clearly non-authoritative narration.

**Needs external validation:** sufficiently long *real* market series, crop-specific seasonal modeling, commodity-wise forecast quality, uncertainty calibration, drift/outlier monitoring, farm advisory review. No guaranteed forecasts are claimed.

## 5. Added API routes

All routes are under `/api/v1/`.

- `GET market/coverage/` — public source coverage, not live bid assertions.
- `GET market/opportunities/?crop=<id>&state=...&grade=...` — price/cost comparison candidates.
- `GET admin/import-monitor/` — administrative import status and flagged rows.
- `GET shipments/<shipment_id>/events/` — restricted milestone timeline.
- `GET shipments/evidence/<event_id>/` — authorized private file download.
- Existing `GET forecast/?crop=<id>&market=<id>&variety=...&grade=...&source=...` now has chronology/ambiguity validation.

## 6. Migration plan and verification

Migrations `0005`–`0008` add ingestion monitoring, quality reasons, shipment events, stronger trading constraints and sold-out inventory behavior.

The code exists but **Django/PostgreSQL migrations have not executed in the authoring environment**. Run `python manage.py makemigrations --check --dry-run`, `python manage.py migrate`, `pytest`, and `npm run build` under CI/staging before claiming it runs. Unit tests and CI recipes are in the source.

## 7. How to use this build without fake data

```bash
cp .env.example .env
# Set a unique PostgreSQL password, Django secret and allowed origins.
docker compose up --build -d
docker compose exec backend python manage.py seed_crops
# Optional: actual government source + authorized key in .env first:
docker compose exec backend python manage.py import_ogd --all --limit 500 --max-pages 100
docker compose exec backend python manage.py evaluate_price_alerts
# Review admin import history after authenticating as a staff administrator.
```

To validate file-based parsing without importing fictitious public observations:
`docker compose exec backend python manage.py import_ogd --file /app/your_actual_export.json` (mount the file yourself); these rows are **quarantined** as unverified. Never upload fixture data as if it were a real market feed.
