# KrishiSetu (कृषिसेतु) — Supabase PostgreSQL & Auth Execution Guide
**Problem Statement:** SIH26132 — Strengthening Market Linkages and Price Discovery for Farmers  
**Architecture:** Django 5.2.19 (Authoritative Engine) + Supabase (PostgreSQL, Auth, Storage, Realtime)  
**Schema Verification Status:** 100% Passed (Automated Integrity Suite `test_supabase_sql_integrity.py`)

---

## 1. What Was Audited, Fixed & Hardened

Before running these scripts, the following architectural and security corrections were applied:

1. **UUID Type Alignment**:
   - `auth.users(id)` in Supabase is a native `UUID`.
   - Django model `User.supabase_uid` was updated from `CharField(64)` to `models.UUIDField` and migration `0009_user_supabase_uid.py` was generated.
   - Schema SQL was updated to `supabase_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL`.

2. **Django Framework & Session Infrastructure**:
   - Added Django's required internal tables: `django_content_type`, `auth_permission`, `auth_group`, `auth_group_permissions`, `django_migrations`, `core_user_groups`, `core_user_user_permissions`, `django_session`.
   - Populated `django_migrations` with initial records up through `0009_user_supabase_uid` to guarantee zero migration collision when Django connects.

3. **Search Path Hijacking Defense (CWE-426)**:
   - Added `SET search_path = public, pg_temp;` to all `SECURITY DEFINER` functions:
     - `get_current_app_user_id()`
     - `get_current_app_user_role()`
     - `is_admin_or_service()`
     - `handle_new_supabase_user()`
   - Added explicit `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` and granted execute only to authorized roles.

4. **Privilege Escalation Defense (CWE-269)**:
   - Automated trigger `handle_new_supabase_user()` validates incoming `raw_user_meta_data->>'role'` against `('FARMER', 'BUYER', 'TRANSPORTER')`.
   - Any attempt to claim `ADMIN` or `INSTITUTION` via public registration metadata is stripped and defaulted to `FARMER`.

5. **Trading & Financial Immutability via PostgREST**:
   - `core_order`: Strictly read-only for clients (`SELECT`). Direct client `INSERT`, `UPDATE`, and `DELETE` are blocked. Writes are orchestrated authoritatively by Django REST Framework using `select_for_update` row locking.
   - `core_listing`: Direct client `INSERT` enforces `reserved_qtl = 0`. Direct client `UPDATE` forbids modifying `reserved_qtl`.
   - `core_offer`: Direct client `UPDATE` is strictly restricted to `status = 'WITHDRAWN'` for pending offers. Counteroffers and acceptances must go through Django.
   - `core_paymentattempt`, `core_settlement`, `core_refundrequest`: Client writes blocked; all financial records orchestrated via Django `service_role`.
   - `core_shipmentevent`: Strictly append-only.

6. **Supabase Storage Buckets & Policies**:
   - `crop-photos`: Public read bucket for listing crop images. Authenticated upload.
   - `kyc-documents`: Private bucket for farmer/buyer KYC documents. Accessible only via user-scoped signed URLs.
   - `dispute-evidence`: Private bucket for order casework. Accessible only to participants.

---

## 2. Exact Execution Order in Supabase

You have two supported deployment options. **Option A is recommended** for standard Django projects.

---

### OPTION A (Recommended: Django Migrations First)

In this approach, Django creates all application tables and constraints via its authoritative ORM migrations, and you then execute the RLS policies and functions in Supabase SQL Editor.

#### Step 1: Set Your Supabase Database Connection in `.env`
In `KrishiSetu/backend/.env`:
```env
DATABASE_URL=postgresql://postgres:[YOUR_SUPABASE_DB_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres?sslmode=require
```

#### Step 2: Apply Authoritative Django Migrations
Open terminal in `KrishiSetu/backend`:
```powershell
.\.venv\Scripts\python.exe manage.py migrate
```
*Expected output:* All migrations from `contenttypes`, `auth`, `core` (0001 through 0009), `sessions`, and `token_blacklist` apply with status `OK`.

#### Step 3: Run RLS & Storage Script in Supabase SQL Editor
1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Open or paste the contents of:  
   `supabase/migrations/20261123_krishisetu_rls_policies.sql`
3. Click **RUN**.
4. Verify success: "Success. No rows returned".

---

### OPTION B (Direct Supabase SQL Editor First)

If you prefer to execute the SQL directly in the Supabase Dashboard before connecting Django:

#### Step 1: Execute Schema Migration
1. Go to **Supabase Dashboard** -> **SQL Editor** -> **New Query**.
2. Open or paste:  
   `supabase/migrations/20261123_krishisetu_production_schema.sql`
3. Click **RUN**.
4. *What this does:* Creates all 26 core application tables, Django auth tables, indexes, check constraints, foreign key to `auth.users(id)`, and pre-populates `django_migrations` table.

#### Step 2: Execute RLS & Security Policies
1. In **Supabase Dashboard** -> **SQL Editor** -> **New Query**.
2. Open or paste:  
   `supabase/migrations/20261123_krishisetu_rls_policies.sql`
3. Click **RUN**.
4. *What this does:* Enables RLS on all 26 core tables + Django system tables, creates the secure helper functions, sets up the `handle_new_supabase_user` trigger, applies trading immutability rules, and provisions storage buckets (`crop-photos`, `kyc-documents`, `dispute-evidence`).

#### Step 3: Verify with Django
Configure `.env` with your Supabase `DATABASE_URL` and run:
```powershell
.\.venv\Scripts\python.exe manage.py showmigrations
```
*Expected output:* Every migration is marked `[X]` (already applied).

---

## 3. Post-Execution Verification Queries

Run the following test queries in the Supabase SQL Editor to verify complete security and schema integrity:

### Verification 1: Confirm All Core Tables and RLS Status
```sql
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'core_%'
ORDER BY tablename;
```
*Expected Result:* 26 rows returned, all showing `rowsecurity = true`.

### Verification 2: Confirm Helper Functions and Search Path
```sql
SELECT 
    proname, 
    prosecdef, 
    proconfig 
FROM pg_proc 
WHERE proname IN ('get_current_app_user_id', 'get_current_app_user_role', 'is_admin_or_service', 'handle_new_supabase_user');
```
*Expected Result:* All 4 functions show `prosecdef = true` (SECURITY DEFINER) and `proconfig = {search_path=public, pg_temp}`.

### Verification 3: Confirm Supabase Storage Buckets
```sql
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id IN ('crop-photos', 'kyc-documents', 'dispute-evidence');
```
*Expected Result:* 3 buckets found. `crop-photos` has `public = true`. `kyc-documents` and `dispute-evidence` have `public = false`.

### Verification 4: Run Automated Integrity Test
In `KrishiSetu/backend`:
```powershell
.\.venv\Scripts\pytest.exe core/tests/test_supabase_sql_integrity.py -v
```
*Expected Result:* 20 passed in < 1s (100% pass rate).
