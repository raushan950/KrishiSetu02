# KrishiSetu Chronological Changelog

All notable changes to the KrishiSetu platform are documented in this file.

---

## [v5.1-supabase] — 2026-11-23

### Added
- **Supabase PostgreSQL Production Schema**: Created complete, production-ready PostgreSQL DDL in `supabase/migrations/20261123_krishisetu_production_schema.sql` covering all 26 application models, relational foreign keys, unique constraints, non-negative checks, and performance indexes.
- **Supabase Row Level Security (RLS)**: Created comprehensive defense-in-depth RLS policies in `supabase/migrations/20261123_krishisetu_rls_policies.sql` enforcing role-based isolation (Farmer, Buyer, Transporter, Admin, Institution) and private document protections.
- **Supabase Auth Token Verification**: Implemented `core.supabase_auth.SupabaseAuthentication` in `KrishiSetu/backend/core/supabase_auth.py` providing cryptographic verification of Supabase access tokens (signature, expiration, issuer, audience), user identity mapping to `supabase_uid`, and strict privilege escalation prevention (disallowing self-assigned ADMIN roles).
- **User Supabase UID Mapping**: Added `supabase_uid` indexed field to `core_user` and applied Django migration `0009_user_supabase_uid`.
- **Supabase Storage Adapter**: Implemented `core.supabase_storage.SupabaseStorage` supporting public buckets (`crop-images`) and private access-controlled buckets (`verification-documents`, `shipment-evidence`) with time-limited signed URLs and automatic local fallback for offline development.
- **Supabase Realtime & Auth Frontend Client**: Implemented `frontend/src/supabaseClient.js` providing client-side sign up, sign in, OAuth redirects, session tokens, and WebSocket real-time subscription channels for orders, offers, and notifications.
- **Multilingual Localization Dictionary**: Created `frontend/src/i18n.js` with comprehensive translations for English, Hindi (हिंदी), and Punjabi (ਪੰਜਾਬੀ) across the entire farmer, buyer, transporter, and institutional user flows.
- **Trading Concurrency & Constraint Suite**: Added `core/tests/test_concurrency.py` verifying race-condition resilience during competing offer acceptances, atomic stock reservation, and database-level check constraints.
- **Supabase Auth & Storage Test Suites**: Added `core/tests/test_supabase_auth.py` (6 tests) and `core/tests/test_supabase_storage.py` (4 tests).

### Fixed
- **Mandi Pipeline Ingestion Test**: Fixed `StopIteration` failure in `core/tests/test_mandi_pipeline.py` by resetting mock side effects before subsequent calls.
- **Trade Resolution Permission Check Order**: Fixed `order_change_respond` in `core/trade_resolution.py` to check processed status before responder identity, allowing proper HTTP 400 Bad Request responses on closed change requests.
- **Django Environment Settings Auto-Loader**: Enhanced `config/settings.py` to automatically discover and parse `.env` without requiring external libraries or manual environment variable injection.
- **Database & Cache Offline Fallback**: Configured `config/settings.py` to gracefully fall back from unreachable container hosts (`@db:`, `@redis:`) to SQLite and `LocMemCache` during local test execution.

---

## [v5.0-safety] — 2026-11-19
- Initial V5 expanded development source with source-backed price discovery, net realised price calculator, and trading resolution workflows.
- Verification-code failure counters persisted; account lockout after failed challenge resends.
- Crop catalogue seed command with zero dummy prices.
- Price alerts and deduplicated evaluation commands.
- Razorpay Orders API initiation, signed callback validation, and raw-body webhook processing.
- Restricted institutional analytics with spreadsheet formula sanitization.
