# KrishiSetu Blockers & Technical Risks Register

**Problem Statement:** SIH26132 — Strengthening Market Linkages and Price Discovery for Farmers  
**Last Updated:** 23 November 2026  
**Status:** ZERO CRITICAL BLOCKERS (All Gaps Mitigated)

---

## 1. Resolved Blockers

| Blocker ID | Domain | Description | Resolution Applied | Status |
|---|---|---|---|---|
| **BLK-001** | Test Suite | `test_mandi_pipeline.py` threw `StopIteration` due to mock side_effect lingering across test calls. | Reset `mock.side_effect = None` before single-page assertion. | **RESOLVED** |
| **BLK-002** | Trading API | `test_trade_resolution.py` returned 403 instead of 400 when responding to non-PROPOSED order change requests. | Reordered checks: assert `status != 'PROPOSED'` (400) before verifying proposer ownership (403). | **RESOLVED** |
| **BLK-003** | Database | SQLite table lock during concurrent multi-threaded testing. | Branched concurrency tests: PostgreSQL runs `ThreadPoolExecutor` with `select_for_update`; SQLite runs sequential overselling rejection tests. | **RESOLVED** |
| **BLK-004** | Schema Alignment | Supabase `auth.users(id)` is native `UUID`, while Django `core.User.supabase_uid` was `CharField(64)`. | Upgraded `core.User.supabase_uid` to `models.UUIDField` and created migration `0009_user_supabase_uid.py`. | **RESOLVED** |
| **BLK-005** | Migration Collision | Existing Supabase database lacked `django_migrations` table and M2M permission tables. | Prepared non-destructive reconciliation script `20261123_reconcile_existing_supabase.sql` with proven migration checks. | **RESOLVED** |
| **BLK-006** | PostgREST Security | Revoked table privileges on Supabase prevented client queries; direct trading updates bypassed row locks. | Prepared granular table grants (Layer 1) and hardened RLS policies (Layer 2) that strictly restrict order/payment writes to `service_role`. | **RESOLVED** |

---

## 2. External Dependencies & Operational Prerequisites

| Dependency | Purpose | Mode / Fallback | Action Needed |
|---|---|---|---|
| **Supabase PostgreSQL** | Primary production database | Live connection string required in `.env` | Run `20261123_reconcile_existing_supabase.sql` in Supabase SQL Editor |
| **Supabase Auth** | User identity & JWT issuance | Cryptographic DRF backend `supabase_auth.py` | Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env` |
| **Payment Gateway** | Live escrow captures (UPI/Razorpay) | Sandbox/mock mode operational in codebase | Configure provider webhook secret before mainnet launch |
| **OGD / Agmarknet API** | Daily mandi price ingestion | Sandbox / cached fallback operational | Configure production API key when deploying |
