# KrishiSetu V5 — verifiable improvements and remaining release blockers

**19 November 2026 — development source only.** This note concerns changes from the supplied V4 source archive. It does not claim successful integration testing, provider approval, certified security, or operational deployment.

## Implemented in source

1. **Source-comparable mandi intelligence.** `GET /api/v1/analytics/history/` now refuses to plot a single series spanning multiple varieties, grades or sources. Instead it returns `PROFILE_SELECTION_REQUIRED` with observed profiles. When the client resubmits `variety`, `grade` and `source`, the API returns an exact-profile series. Historical observations remain explicitly distinct from executable buyer bids.
2. **Safe guided market recommendations.** `POST /api/v1/assistant/guided/` requires a single comparable variety/grade/source and no longer ranks observations older than seven calendar days. If only stale data exists, it returns `HISTORICAL_DATA` and an empty `ranked` list, rather than a misleading recommendation. Recent markets with user-supplied quantity and cost assumptions can still be compared. All facts retain source and observation date.
3. **Correct price charts.** The public mandi-prices page no longer connects modal prices from unrelated crops and mandis into one trend. A chart is shown only after selecting one crop, market, and (when necessary) one exact profile. The account intelligence screen offers the same profile-selection workflow.
4. **Marketplace usability.** Public listings exclude fully reserved or sold-out inventory. This avoids displaying listings that cannot receive a new offer at the displayed quantity; it does not change inventory database constraints.
5. **Institutional disclosure safeguards.** API and CSV institutional aggregates now suppress crop/location groups with fewer than five observations. Platform-wide counters below five are hidden rather than displayed as identifying small counts. This is a conservative UI/data-disclosure safeguard **not a guarantee of privacy compliance** or protection against every inference.
6. **Safer CSV exports.** `core.export_safety.spreadsheet_safe()` neutralizes leading formula characters including those concealed by whitespace, tabs, line breaks, or a BOM. The institutional CSV uses it for crop/state/district labels.
7. **Regression coverage and CI.** New Django tests exercise profile ambiguity, stale recommendations, exact-profile history, institutional small-group suppression, and CSV filtering. Five additional pure-Python tests cover export injection, count suppression and market/forecast input checks. CI executes the pure tests and retains the Django/PostgreSQL testing job.

## Actual checks run in this environment

| Check | Result |
|---|---|
| `python scripts/test_pure_engine.py` | **7 tests passed** |
| `python scripts/test_v5_pure.py` | **5 tests passed** |
| `python scripts/check_static.py` | **38 standalone checks passed** |
| `python -m compileall -q backend` | **Passed** (syntax only) |
| TypeScript parser reading 6 frontend JS/JSX files | **6/6 parsed** (syntax only) |
| `cd frontend && npm run build` | **Not run successfully:** `vite: not found` |
| Install Python requirements | **Blocked:** package-index DNS/network unavailable; Django not installed |
| Full `manage.py check`, migrations, Django/PostgreSQL tests | **Not executed** |
| Full browser E2E, providers, cloud deployment | **Not executed** |

Source test files are **not** counted as passed until executed under the full Django runner. Market and payment data are never fabricated as live data. External access to OGD, SMS, Google identity, routing, bank reconciliation, payment processing and deployment credentials still requires owner authorization and integration testing.

## Steps to validate before use with real farmers

From an internet-enabled development workstation:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export DJANGO_DEBUG=1 DJANGO_SECRET_KEY='replace-with-a-unique-dev-only-secret'
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
pytest -q
cd ../frontend
npm install --no-audit --no-fund
npm run build
```

Run PostgreSQL-backed tests using the CI service definition. Also perform live provider sandbox tests, accessibility tests, threat modeling, security scanning, restore drills, and agriculture-specific field validation. Do **not** launch with real payments or claim government certification solely based on this source package.
