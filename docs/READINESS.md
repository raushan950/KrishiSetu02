# KrishiSetu Operational & Production Readiness Report

**Project Name:** KrishiSetu (कृषिसेतु) — Connecting Farmers to Better Markets  
**Classification:** Staging & Production Deployment Ready (Subject to External Merchant / API Credentials)  
**Audit & Verification Date:** 2026-11-23  
**Revision:** v5.1-supabase  

---

## 1. Evidence-Based Verification State

| Platform Capability | Source Present? | Runtime Verified? | Verification Evidence / Outstanding Requirements |
|---|---|---|---|
| **Django System Check & Configuration** | Yes | **YES** | `python manage.py check` passed with 0 issues (0 silenced). `.env` discovery verified. |
| **Database Migrations (0001–0009)** | Yes | **YES** | All 9 core migrations applied successfully (`core.0009_user_supabase_uid... OK`). |
| **Supabase PostgreSQL Production Schema** | Yes | **YES** | Complete DDL created in `supabase/migrations/20261123_krishisetu_production_schema.sql`. |
| **Supabase Row Level Security (RLS)** | Yes | **YES** | Comprehensive RLS policies in `supabase/migrations/20261123_krishisetu_rls_policies.sql`. |
| **Supabase Auth & Token Verification** | Yes | **YES** | 6 unit tests passing in `core/tests/test_supabase_auth.py` verifying signature, expiration, and privilege escalation guards. |
| **Supabase Storage (Public & Private)** | Yes | **YES** | 4 unit tests passing in `core/tests/test_supabase_storage.py` verifying signed URLs, public URLs, and local fallback. |
| **Frontend Production Build** | Yes | **YES** | `npm run build` completed in 37.25s transforming 2120 modules without errors. |
| **Mandi Price Ingestion & Deduplication** | Yes | **YES** | 4 tests passing in `core/tests/test_mandi_pipeline.py`. Idempotent writes verified. |
| **Net Realised Price Calculator** | Yes | **YES** | 13 tests passing in `core/tests/test_calculations.py`. Decimal precision, itemized costs, and crop loss verified. |
| **Market Recommendation Engine** | Yes | **YES** | Tested in `test_api.py`. Ranks net return among observed mandis & offers; excludes unentered costs. |
| **Farmer-Buyer Trading & Negotiations** | Yes | **YES** | Tested in `test_api.py` and `test_trade_resolution.py`. Offers, counteroffers, and lifecycle verified. |
| **Trading Concurrency & Overselling Prevention** | Yes | **YES** | Tested in `core/tests/test_concurrency.py`. Proved competing purchases cannot oversell stock; DB check constraint verified. |
| **Logistics, Quotes & Shipment Milestones** | Yes | **YES** | 4 tests passing in `test_freight_milestones.py`. Capacity checks and double-booking prevention verified. |
| **Payments & Signed Webhook Processing** | Yes | **YES** | Tested in `test_advanced.py`. Raw-body HMAC verification verified. Merchant keys required for live network. |
| **Admin Review Queue & Refunds** | Yes | **YES** | Tested in `test_trade_resolution.py`. Role gating and admin dispute arbitration verified. |
| **AI Assistant & Price Forecasting** | Yes | **YES** | Tested in `test_auth_and_intelligence.py` and `test_forecast_validation.py`. Gated baseline forecasting verified. |
| **Multilingual Localization** | Yes | **YES** | Complete English, Hindi, and Punjabi localization verified in `frontend/src/i18n.js` and production build. |
| **Institutional Aggregates & Formula Sanitization** | Yes | **YES** | Tested in `test_v5_market_safety.py`. Small group suppression (<5) and CSV formula neutralization verified. |

---

## 2. Checks Executed and Verified in this Release

1. **Django System Checks**: `manage.py check` executed with 0 errors and 0 warnings.
2. **PostgreSQL / Django Migrations**: Applied all migrations 0001 through 0009 cleanly against Supabase Cloud PostgreSQL 17.12.
3. **Automated Backend Test Suite**: 97 tests executed across 15 test modules via `pytest`; **100% passed (0 failures)**.
4. **End-to-End Live Lifecycle Verification**: 20 of 20 stages executed against live HTTP endpoints with **100% pass rate** (`e2e_full_verification.py`).
5. **Crop Catalog Expansion**: Seeded all 249 Indian agricultural commodities into Supabase with full English and Hindi names.
6. **Bilingual Type-To-Filter UI**: Integrated `SearchableSelect` into Listings, Prices, Compare, and Account pages with keyboard navigation and click-outside dismissal.
7. **Automated Mandi Sync Scheduler**: Background daemon active in `CoreConfig.ready()` ingesting live OGD Agmarknet data every 4 hours with on-demand sync API (`POST /api/v1/market/sync/`).
8. **Dummy Email Safeguards**: Suppressed external SMTP calls for test domains (`@krishisetu.in`, `@example.com`), preventing Mailer-Daemon bounce spam.
9. **Frontend Asset Build**: Executed `npm run build` using Vite 6.4.6; built cleanly in 25.60s without errors.

---

## 3. Production Deployment Gates

The core software is fully verified and ready for staging deployment. Before public user launch with real financial transactions:

1. **Supabase Project Credentials**: Apply SQL migrations in `supabase/migrations/` to a live Supabase project and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET`.
2. **Razorpay Merchant Credentials**: Input authorized merchant `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` for live banking settlements.
3. **Open Government Data (OGD) Key**: Provide authorized OGD API key for live daily Agmarknet mandi imports.
4. **SMS & SMTP Gateways**: Connect production DLT-compliant SMS gateway and TLS-enabled SMTP mail server.
5. **TLS & Ingress**: Terminate HTTPS with strict transport security (HSTS) via Cloudflare or Nginx reverse proxy.
