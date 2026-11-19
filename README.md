# KrishiSetu (कृषिसेतु)

**Connecting Farmers to Better Markets.** An independent agricultural market intelligence and farmer-to-buyer trading application aligned with SIH26132.

> **Delivery classification: integrated DEVELOPMENT implementation, not government-approved and not production certified.** Core modules have source code, but Django runtime tests, PostgreSQL migrations, frontend build, live providers and deployment could not be executed in the authoring container. Do not expose this release to real users or accept real payments without the readiness gates in `docs/READINESS.md`.

## 19 November 2026 — V5 source safety and quality updates

See **`docs/V5_MARKET_SAFETY_AND_QA.md`** for source-level changes and executed test evidence. Price history and assistant recommendations now require comparable variety/grade/source data; stale observations cannot be ranked; charting no longer mixes crop and mandi series. Sold-out marketplace items are excluded from public listings. Institutional exports suppress small groups and neutralize spreadsheet formulas. **This source is still not production-certified.**

## Included working designs and code

- **Authentication:** Farmer/buyer/transporter registration, email/password, Google Identity Services when configured, backend Google token verification and secure existing-account linking, email verification links, real-provider SMS OTP, account and role checks, refresh-token rotation and revocation, password reset and password change. No fixed OTP or fake live verification.
- **Price discovery:** Crop catalogue, OGD/Agmarknet importer, mandi observation dates and sources, market comparisons, historical charts, conservative minimum-data-gated forecast endpoint, configurable price alerts and a scheduled-import command. Market prices are NEVER fabricated or seeded.
- **Financial comparison:** Transparent Decimal net returns with labour, freight, fees and crop-loss inputs. Ranked mandi observations + pending verified buyer offers for the farmer; unentered destinations cannot be ranked.
- **Trading:** Farmer farms, image-supported crop listings, buyer offers, negotiation/counteroffers, transactional inventory reservation and order cancellation.
- **Logistics:** Vehicle verification via admin, transport request/quotes, carrier assignment, shipment milestones, delivery and manual settlement records.
- **Gateway boundary:** Configurable Razorpay Orders API initiation, checkout callback signature validation, signed raw-body webhook processing, duplicate event protection and captured-payment records. **Includes admin-reviewed refund request source and signed refund webhook support; does not prove merchant bank settlement or enable escrow.** Actual gateway behavior is UNTESTED; credentials and approval are required.
- **Operations:** PostgreSQL database and migrations, React/Vite frontend, restricted institutional aggregates, Django admin, audit events, Docker Compose dev stack, CI checks and test source.

## Quick start (development only)

Requirements: Docker Engine with Compose, or Python 3.12+, Node 22+ and PostgreSQL 16. Internet access is required to install third-party packages and pull images.

```bash
cp .env.example .env
# Edit .env: replace POSTGRES_PASSWORD, DJANGO_SECRET_KEY and other required local settings.
docker compose up --build
# In another terminal, add catalogue names (NEVER dummy prices):
docker compose exec backend python manage.py seed_crops
```

Open **http://localhost:5173** (web UI), **http://localhost:8000/api/v1/status/** (provider status), **http://localhost:8000/health/** (DB health), or **http://localhost:8000/admin/** (admin). Admin access requires:

```bash
docker compose exec backend python manage.py createsuperuser
```

To import actual market data, acquire the required authorized OGD API key and resource ID, confirm the current source schema and terms, then:

```bash
docker compose exec backend python manage.py import_ogd --all --limit 500 --max-pages 100
docker compose exec backend python manage.py evaluate_price_alerts
```

Optional scheduled ingestion (every 24 hours) **only after authorizing and verifying the data source**:

```bash
docker compose --profile scheduled-ingestion up -d scheduler
```

When the API source is not configured, the UI deliberately displays "no data" rather than generated mandi prices. Trading requires both verified email and verified mobile number, so real SMS/SMTP providers must be connected. Buyer-accepted quantity, manual counterparty settlement acknowledgements, refunds and disputes are separate auditable states. Local email console delivery is for development only.

### Run without Docker

```bash
# Terminal 1, from backend/
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export DJANGO_DEBUG=1
export DJANGO_SECRET_KEY='your-unique-local-secret'
python manage.py migrate
python manage.py seed_crops
python manage.py runserver

# Terminal 2, from frontend/
npm install
npm run dev
```

Local SQLite is development-only. PostgreSQL is required for testing stock reservation and order race conditions. On Windows use the equivalent venv activation and environment setup commands.

## Verification in an environment with dependencies

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
pytest -q
cd ../frontend
npm install --no-audit --no-fund
npm run build
```

**Evidence obtained in the authoring container:** Python `compileall` and TypeScript JSX parser checks; deterministic calculation and forecasting checks. **Not obtained:** Django system checks, migration execution, PostgreSQL integration tests, frontend package build, browser E2E, provider sandbox tests or public deployment. See `docs/READINESS.md` for exact status.

## Documentation

- `docs/ENGINEERING.md` — architecture, API, security and finance methods
- `docs/INTEGRATIONS.md` — credentials, provider configuration and operational status
- `docs/READINESS.md` — risk register, remaining features and production gates
- `docs/USER_GUIDE.md` — farmer, buyer, transporter and institutional workflows
- `docs/OPERATIONS.md` — lifecycle, backups, deployment checks and recovery
- `docs/IMPLEMENTATION_MATRIX.md` — master-prompt traceability (24 sections)
- `docs/CHANGES_V3.md` — earlier features and changes
- `docs/IMPLEMENTATION_V4.md` — new mandi, trading, logistics, forecasting design and limits
- `docs/TESTS_V4.md` — current verification evidence and unrun test gates
- `docs/READINESS.md` — exact unverified items and go/no-go gates

**Independent development project. No government affiliation or approval is represented.**

## Added development routes (v3)

All below `/api/v1/`; secured endpoints require bearer authentication and role/ownership rules.

- `GET /auth/sessions/`, `POST /auth/sessions/<jti>/revoke/` — refresh-session control
- `POST /auth/email-change/request/`, `POST /auth/email-change/confirm/` — verified new-mailbox change
- `PATCH|DELETE /listings/<id>/`, `POST /offers/<id>/reject/`, `POST /offers/<id>/withdraw/`
- `POST /orders/<uuid>/accept-delivery/`, `GET /delivery/acceptances/`
- `GET|POST /order-changes/`, `POST /order-changes/<id>/respond/` — two-party changes
- `GET|POST /disputes/`, `POST /disputes/<id>/resolve/` — administrator decisions
- `GET|POST /refunds/`, `POST /refunds/<id>/review/` — admin review + provider, signed webhook confirmation required
- `POST /settlements/<id>/acknowledge/` — counterparty statement, not bank proof
- `GET /analytics/history/?crop=...&market=...`, `POST /assistant/guided/`, `POST /routing/road/`
- `GET /institutional/analytics.csv`, `GET /admin/review-queue/`, `POST /admin/vehicles/<id>/verify/`

Do not confuse a transporter-reported `DELIVERED` status with `accepted_qtl`: only a buyer-confirmed receipt debits inventory. A refund is not successful until the signed provider event is reconciled.

**Developer setup:** copy `.env.example` to `.env`, set distinct local secrets and an authorized SMS provider to exercise verified trades. Run `docker compose up --build` then migrate and seed the crop catalogue. For a sandbox transaction, test merchant credentials and webhooks are required; no fabricated payment or price fixtures are served to production pages.

## Verification record

See [docs/CHECK_RESULTS.md](docs/CHECK_RESULTS.md) for precise executed checks and remaining test blockers. This archive is development source, not a certified production system.

## 19 November 2026 — module-focused v4 engineering

The latest work is described in **`docs/IMPLEMENTATION_V4.md`**. New source code includes: validated and monitored paginated mandi ingestion; recent per-market selling opportunities; a corrected full-sale inventory constraint; vehicle schedule and capacity protections; private shipment evidence/timeline; and chronological model selection/holdout metrics in forecasting. **The files are present and syntax/pure-unit checked, not yet end-to-end verified.** See `docs/TESTS_V4.md` and run the actual CI/staging gates.
