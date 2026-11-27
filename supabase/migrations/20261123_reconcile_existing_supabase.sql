-- =============================================================================
-- KrishiSetu (कृषिसेतु) Non-Destructive Schema Reconciliation & Security Migration
-- Specifically for EXISTING Supabase Database with Pre-Existing core_ Tables
-- Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery
-- Mode: SAFE & NON-DESTRUCTIVE (Zero table drops, zero data deletion)
-- Date: 2026-11-23
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Enable Necessary Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- STEP 2: Non-Destructively Reconcile core_user.supabase_uid Data Type
-- Handles pre-existing VARCHAR(64) by safely converting to native UUID
-- =============================================================================
DO $$
BEGIN
    -- 1. Check if supabase_uid is character varying and convert to native UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'core_user' 
          AND column_name = 'supabase_uid' 
          AND data_type = 'character varying'
    ) THEN
        ALTER TABLE core_user 
            ALTER COLUMN supabase_uid TYPE UUID 
            USING (CASE WHEN supabase_uid IS NULL OR trim(supabase_uid::text) = '' THEN NULL ELSE supabase_uid::uuid END);
    END IF;

    -- 2. Add foreign key to auth.users(id) if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
          AND table_name = 'core_user' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name = 'core_user_supabase_uid_fkey'
    ) THEN
        ALTER TABLE core_user 
            ADD CONSTRAINT core_user_supabase_uid_fkey 
            FOREIGN KEY (supabase_uid) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_core_user_supabase_uid ON core_user(supabase_uid);

-- =============================================================================
-- STEP 3: Create Missing Django Framework & Auth Infrastructure Tables
-- (These tables were missing from original schema and are required by Django ORM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model)
);

CREATE TABLE IF NOT EXISTS auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id) DEFERRABLE INITIALLY DEFERRED,
    codename VARCHAR(100) NOT NULL,
    CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename)
);

CREATE TABLE IF NOT EXISTS auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS auth_group_permissions (
    id BIGSERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) DEFERRABLE INITIALLY DEFERRED,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id)
);

CREATE TABLE IF NOT EXISTS core_user_groups (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES core_user(id) DEFERRABLE INITIALLY DEFERRED,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT core_user_groups_user_id_group_id_c612f00a_uniq UNIQUE (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS core_user_user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES core_user(id) DEFERRABLE INITIALLY DEFERRED,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT core_user_user_permissions_user_id_permission_id_7c0e69fb_uniq UNIQUE (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS django_session (
    session_key VARCHAR(40) PRIMARY KEY,
    session_data TEXT NOT NULL,
    expire_date TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS django_session_expire_date_idx ON django_session(expire_date);

CREATE TABLE IF NOT EXISTS django_admin_log (
    id SERIAL PRIMARY KEY,
    action_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    object_id TEXT,
    object_repr VARCHAR(200) NOT NULL,
    action_flag SMALLINT NOT NULL CHECK (action_flag >= 0),
    change_message TEXT NOT NULL,
    content_type_id INTEGER REFERENCES django_content_type(id) DEFERRABLE INITIALLY DEFERRED,
    user_id BIGINT NOT NULL REFERENCES core_user(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS django_migrations (
    id BIGSERIAL PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =============================================================================
-- STEP 4: Ensure Trade Integrity Check Constraints Exist (Migration 0007)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND constraint_name = 'reserved_le_quantity'
    ) THEN
        ALTER TABLE core_listing 
            ADD CONSTRAINT reserved_le_quantity CHECK (reserved_qtl <= quantity_qtl);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND constraint_name = 'non_negative_reserved'
    ) THEN
        ALTER TABLE core_listing 
            ADD CONSTRAINT non_negative_reserved CHECK (reserved_qtl >= 0);
    END IF;
END $$;

-- =============================================================================
-- STEP 5: Proven Migration History Reconciliation
-- Asserts physical existence of components before registering migration rows
-- =============================================================================

-- 5.1 Django Framework Migrations
INSERT INTO django_migrations (app, name, applied)
SELECT 'contenttypes', '0001_initial', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'django_content_type')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'contenttypes' AND name = '0001_initial');

INSERT INTO django_migrations (app, name, applied)
SELECT 'contenttypes', '0002_remove_content_type_name', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'django_content_type')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'contenttypes' AND name = '0002_remove_content_type_name');

INSERT INTO django_migrations (app, name, applied)
SELECT 'auth', '0001_initial', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_permission')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'auth' AND name = '0001_initial');

INSERT INTO django_migrations (app, name, applied)
SELECT 'auth', m, timezone('utc', now())
FROM unnest(ARRAY[
    '0002_alter_permission_name_max_length',
    '0003_alter_user_email_max_length',
    '0004_alter_user_username_opts',
    '0005_alter_user_last_login_null',
    '0006_require_contenttypes_0002',
    '0007_alter_validators_add_error_messages',
    '0008_alter_user_username_max_length',
    '0009_alter_user_last_name_max_length',
    '0010_alter_group_name_max_length',
    '0011_update_proxy_permissions',
    '0012_alter_user_first_name_max_length'
]) AS m
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_permission')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'auth' AND name = m);

INSERT INTO django_migrations (app, name, applied)
SELECT 'sessions', '0001_initial', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'django_session')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'sessions' AND name = '0001_initial');

INSERT INTO django_migrations (app, name, applied)
SELECT 'admin', m, timezone('utc', now())
FROM unnest(ARRAY[
    '0001_initial',
    '0002_logentry_remove_auto_add',
    '0003_logentry_add_action_flag_choices'
]) AS m
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'django_admin_log')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'admin' AND name = m);

-- 5.2 Core Migrations Proven by Physical Schema Objects
INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0001_initial', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_user')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_order')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0001_initial');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0002_price_alert_payments', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_pricealert')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_paymentwebhookevent')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0002_price_alert_payments');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0003_trade_resolution', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_tradedispute')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_orderchangerequest')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0003_trade_resolution');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0004_email_change', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_emailchangechallenge')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0004_email_change');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0005_market_import_monitoring', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_marketimportrun')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0005_market_import_monitoring');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0006_shipment_event', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_shipmentevent')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0006_shipment_event');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0007_trade_integrity_checks', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = 'reserved_le_quantity')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0007_trade_integrity_checks');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0008_sold_out_inventory', timezone('utc', now())
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'core_listing')
  AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0008_sold_out_inventory');

INSERT INTO django_migrations (app, name, applied)
SELECT 'core', '0009_user_supabase_uid', timezone('utc', now())
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'core_user' AND column_name = 'supabase_uid' AND data_type = 'uuid'
)
AND NOT EXISTS (SELECT 1 FROM django_migrations WHERE app = 'core' AND name = '0009_user_supabase_uid');

-- =============================================================================
-- STEP 6: Granular Table Privilege Restoration (Defense-in-Depth Layer 1)
-- Restores minimum required privileges to anon/authenticated so PostgREST can operate
-- while strictly withholding write privileges on orders, payments, and settlements.
-- =============================================================================

-- 6.1 Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 6.2 Public Read (Anon & Authenticated)
GRANT SELECT ON core_crop, core_market, core_mandiprice TO anon, authenticated;

-- 6.3 Authenticated Participant Read
GRANT SELECT ON 
    core_user, core_farm, core_listing, core_offer, core_order, 
    core_vehicle, core_freightrequest, core_freightquote, core_shipment, 
    core_shipmentevent, core_deliveryacceptance, core_orderchangerequest, 
    core_tradedispute, core_paymentattempt, core_settlement, core_notification, 
    core_pricealert 
TO authenticated;

-- 6.4 Controlled Authenticated Writes (Subject to RLS Row Restrictions)
GRANT INSERT ON core_offer, core_listing, core_vehicle, core_freightquote, core_shipmentevent, core_tradedispute, core_pricealert TO authenticated;
GRANT UPDATE ON core_user, core_listing, core_offer, core_notification, core_vehicle, core_pricealert TO authenticated;
GRANT DELETE ON core_pricealert TO authenticated;

-- 6.5 Strictly ZERO Client Privileges on Authoritative Financial & Internal Tables
-- (These tables remain accessible ONLY by service_role and Django backend)
REVOKE ALL ON 
    django_migrations, django_session, django_content_type, auth_permission, 
    auth_group, auth_group_permissions, core_user_groups, core_user_user_permissions, 
    django_admin_log, core_verificationchallenge, core_emailchangechallenge, 
    core_auditevent, core_paymentwebhookevent, core_marketimportrun, core_refundrequest
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON 
    core_order, core_paymentattempt, core_settlement, core_deliveryacceptance, 
    core_orderchangerequest, core_freightrequest, core_shipment, core_mandiprice, core_crop, core_market
FROM anon, authenticated;

-- =============================================================================
-- STEP 7: Secure Database Functions (Zero Search Path Hijacking CWE-426)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_current_app_user_id()
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id FROM core_user WHERE supabase_uid = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_current_app_user_role()
RETURNS VARCHAR(20) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM core_user WHERE supabase_uid = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin_or_service()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT (
        auth.role() = 'service_role' OR
        get_current_app_user_role() IN ('ADMIN', 'INSTITUTION')
    );
$$;

REVOKE ALL ON FUNCTION get_current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_app_user_id() TO authenticated, service_role, anon;

REVOKE ALL ON FUNCTION get_current_app_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_app_user_role() TO authenticated, service_role, anon;

REVOKE ALL ON FUNCTION is_admin_or_service() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin_or_service() TO authenticated, service_role, anon;

-- =============================================================================
-- STEP 8: Supabase Auth Hook (Privilege Escalation Protection CWE-269)
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_supabase_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role VARCHAR(20);
    v_preferred_lang VARCHAR(5);
    v_existing_id BIGINT;
BEGIN
    -- Whitelist allowed self-registered roles to block privilege escalation
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'FARMER');
    IF v_role NOT IN ('FARMER', 'BUYER', 'TRANSPORTER') THEN
        v_role := 'FARMER';
    END IF;

    v_preferred_lang := COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'hi');
    IF length(v_preferred_lang) > 5 THEN
        v_preferred_lang := 'hi';
    END IF;

    -- Check if an unlinked user with this email already exists
    SELECT id INTO v_existing_id FROM core_user WHERE email = LOWER(NEW.email) AND supabase_uid IS NULL LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE core_user 
        SET supabase_uid = NEW.id,
            email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, email_verified)
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO core_user (
            password,
            email,
            supabase_uid,
            role,
            preferred_language,
            first_name,
            last_name,
            phone,
            email_verified,
            is_active,
            is_staff,
            is_superuser,
            date_joined,
            created_at
        ) VALUES (
            '!',
            LOWER(NEW.email),
            NEW.id,
            v_role,
            v_preferred_lang,
            COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
            COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
            NULLIF(NEW.raw_user_meta_data->>'phone', ''),
            (NEW.email_confirmed_at IS NOT NULL),
            TRUE,
            FALSE,
            FALSE,
            timezone('utc', now()),
            timezone('utc', now())
        ) ON CONFLICT (email) DO UPDATE
        SET supabase_uid = EXCLUDED.supabase_uid
        WHERE core_user.supabase_uid IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION handle_new_supabase_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_new_supabase_user() TO authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_supabase_user();

-- =============================================================================
-- STEP 9: Hardened Row Level Security (RLS) Policies
-- Enforces defense-in-depth trading immutability and record ownership
-- =============================================================================

-- Enable RLS on Django internal tables
ALTER TABLE IF EXISTS django_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS django_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS django_content_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS core_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS core_user_user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service django_migrations" ON django_migrations;
CREATE POLICY "Service django_migrations" ON django_migrations FOR ALL USING (auth.role() = 'service_role');

-- 9.1 Crops, Markets & Mandi Prices
DROP POLICY IF EXISTS "Public crops read" ON core_crop;
CREATE POLICY "Public crops read" ON core_crop FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin crops manage" ON core_crop;
CREATE POLICY "Admin crops manage" ON core_crop FOR ALL USING (is_admin_or_service());

DROP POLICY IF EXISTS "Public markets read" ON core_market;
CREATE POLICY "Public markets read" ON core_market FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin markets manage" ON core_market;
CREATE POLICY "Admin markets manage" ON core_market FOR ALL USING (is_admin_or_service());

DROP POLICY IF EXISTS "Public valid mandi prices read" ON core_mandiprice;
CREATE POLICY "Public valid mandi prices read" ON core_mandiprice FOR SELECT USING (quality_status = 'VALID' OR is_admin_or_service());

DROP POLICY IF EXISTS "Service mandi prices write" ON core_mandiprice;
CREATE POLICY "Service mandi prices write" ON core_mandiprice FOR ALL USING (auth.role() = 'service_role');

-- 9.2 Users & Profiles
DROP POLICY IF EXISTS "Users read own profile" ON core_user;
CREATE POLICY "Users read own profile" ON core_user FOR SELECT USING (supabase_uid = auth.uid() OR is_admin_or_service());

DROP POLICY IF EXISTS "Users update own profile" ON core_user;
CREATE POLICY "Users update own profile" ON core_user FOR UPDATE USING (supabase_uid = auth.uid())
WITH CHECK (
    supabase_uid = auth.uid() AND
    role = (SELECT role FROM core_user WHERE id = get_current_app_user_id()) AND
    is_staff = FALSE AND
    is_superuser = FALSE
);

DROP POLICY IF EXISTS "Service user manage" ON core_user;
CREATE POLICY "Service user manage" ON core_user FOR ALL USING (auth.role() = 'service_role');

-- 9.3 Listings & Offers
DROP POLICY IF EXISTS "Active listings readable" ON core_listing;
CREATE POLICY "Active listings readable" ON core_listing FOR SELECT USING (status = 'ACTIVE' OR farmer_id = get_current_app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "Farmers insert listing" ON core_listing;
CREATE POLICY "Farmers insert listing" ON core_listing FOR INSERT WITH CHECK (farmer_id = get_current_app_user_id() AND reserved_qtl = 0);

DROP POLICY IF EXISTS "Farmers update own listing" ON core_listing;
CREATE POLICY "Farmers update own listing" ON core_listing FOR UPDATE USING (farmer_id = get_current_app_user_id())
WITH CHECK (farmer_id = get_current_app_user_id() AND reserved_qtl = (SELECT l.reserved_qtl FROM core_listing l WHERE l.id = core_listing.id));

DROP POLICY IF EXISTS "Service listing manage" ON core_listing;
CREATE POLICY "Service listing manage" ON core_listing FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Offers visible to buyer and farmer" ON core_offer;
CREATE POLICY "Offers visible to buyer and farmer" ON core_offer FOR SELECT USING (
    buyer_id = get_current_app_user_id() OR
    EXISTS (SELECT 1 FROM core_listing l WHERE l.id = listing_id AND l.farmer_id = get_current_app_user_id()) OR
    is_admin_or_service()
);

DROP POLICY IF EXISTS "Buyers insert pending offer" ON core_offer;
CREATE POLICY "Buyers insert pending offer" ON core_offer FOR INSERT WITH CHECK (
    buyer_id = get_current_app_user_id() AND proposed_by_id = get_current_app_user_id() AND status = 'PENDING'
);

DROP POLICY IF EXISTS "Buyers withdraw own offer" ON core_offer;
CREATE POLICY "Buyers withdraw own offer" ON core_offer FOR UPDATE USING (
    buyer_id = get_current_app_user_id() AND status = 'PENDING'
) WITH CHECK (
    buyer_id = get_current_app_user_id() AND status = 'WITHDRAWN'
);

DROP POLICY IF EXISTS "Service offer manage" ON core_offer;
CREATE POLICY "Service offer manage" ON core_offer FOR ALL USING (auth.role() = 'service_role');

-- 9.4 Orders (Strictly Read-Only for Clients)
DROP POLICY IF EXISTS "Orders visible to participants" ON core_order;
CREATE POLICY "Orders visible to participants" ON core_order FOR SELECT USING (
    farmer_id = get_current_app_user_id() OR buyer_id = get_current_app_user_id() OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Service orders manage" ON core_order;
CREATE POLICY "Service orders manage" ON core_order FOR ALL USING (auth.role() = 'service_role');

-- 9.5 Payments & Settlements (Strictly Service Role Orchestrated)
DROP POLICY IF EXISTS "Payment attempts visible to order parties" ON core_paymentattempt;
CREATE POLICY "Payment attempts visible to order parties" ON core_paymentattempt FOR SELECT USING (
    EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Service payment attempts manage" ON core_paymentattempt;
CREATE POLICY "Service payment attempts manage" ON core_paymentattempt FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Webhooks service only" ON core_paymentwebhookevent;
CREATE POLICY "Webhooks service only" ON core_paymentwebhookevent FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Settlements visible to order parties" ON core_settlement;
CREATE POLICY "Settlements visible to order parties" ON core_settlement FOR SELECT USING (
    declared_by_id = get_current_app_user_id() OR acknowledged_by_id = get_current_app_user_id() OR
    EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Service settlements manage" ON core_settlement;
CREATE POLICY "Service settlements manage" ON core_settlement FOR ALL USING (auth.role() = 'service_role');

-- 9.6 Logistics & Shipments
DROP POLICY IF EXISTS "Transporter vehicles manage" ON core_vehicle;
CREATE POLICY "Transporter vehicles manage" ON core_vehicle FOR ALL USING (transporter_id = get_current_app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "Freight requests visible to transporters and parties" ON core_freightrequest;
CREATE POLICY "Freight requests visible to transporters and parties" ON core_freightrequest FOR SELECT USING (
    get_current_app_user_role() IN ('TRANSPORTER', 'ADMIN', 'INSTITUTION') OR
    EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id()))
);

DROP POLICY IF EXISTS "Service freight requests manage" ON core_freightrequest;
CREATE POLICY "Service freight requests manage" ON core_freightrequest FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Freight quotes visible to transporter and farmer" ON core_freightquote;
CREATE POLICY "Freight quotes visible to transporter and farmer" ON core_freightquote FOR SELECT USING (
    transporter_id = get_current_app_user_id() OR
    EXISTS (
        SELECT 1 FROM core_freightrequest fr
        JOIN core_order o ON o.id = fr.order_id
        WHERE fr.id = freight_request_id AND o.farmer_id = get_current_app_user_id()
    ) OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Transporters submit freight quotes" ON core_freightquote;
CREATE POLICY "Transporters submit freight quotes" ON core_freightquote FOR INSERT WITH CHECK (
    transporter_id = get_current_app_user_id()
);

DROP POLICY IF EXISTS "Service freight quotes manage" ON core_freightquote;
CREATE POLICY "Service freight quotes manage" ON core_freightquote FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Shipments visible to parties and carrier" ON core_shipment;
CREATE POLICY "Shipments visible to parties and carrier" ON core_shipment FOR SELECT USING (
    EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
    EXISTS (SELECT 1 FROM core_freightquote fq WHERE fq.id = quote_id AND fq.transporter_id = get_current_app_user_id()) OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Service shipments manage" ON core_shipment;
CREATE POLICY "Service shipments manage" ON core_shipment FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Shipment events visible to parties" ON core_shipmentevent;
CREATE POLICY "Shipment events visible to parties" ON core_shipmentevent FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM core_shipment s
        JOIN core_order o ON o.id = s.order_id
        WHERE s.id = shipment_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())
    ) OR actor_id = get_current_app_user_id() OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Transporters append shipment events" ON core_shipmentevent;
CREATE POLICY "Transporters append shipment events" ON core_shipmentevent FOR INSERT WITH CHECK (
    actor_id = get_current_app_user_id() AND
    EXISTS (
        SELECT 1 FROM core_shipment s
        JOIN core_freightquote fq ON fq.id = s.quote_id
        WHERE s.id = shipment_id AND fq.transporter_id = get_current_app_user_id()
    )
);

DROP POLICY IF EXISTS "Service shipment events manage" ON core_shipmentevent;
CREATE POLICY "Service shipment events manage" ON core_shipmentevent FOR ALL USING (auth.role() = 'service_role');

-- 9.7 Casework & Disputes
DROP POLICY IF EXISTS "Disputes visible to participants" ON core_tradedispute;
CREATE POLICY "Disputes visible to participants" ON core_tradedispute FOR SELECT USING (
    opened_by_id = get_current_app_user_id() OR
    EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR is_admin_or_service()
);

DROP POLICY IF EXISTS "Participants open dispute" ON core_tradedispute;
CREATE POLICY "Participants open dispute" ON core_tradedispute FOR INSERT WITH CHECK (
    opened_by_id = get_current_app_user_id() AND status = 'OPEN' AND
    EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id()))
);

DROP POLICY IF EXISTS "Admin disputes resolve" ON core_tradedispute;
CREATE POLICY "Admin disputes resolve" ON core_tradedispute FOR ALL USING (is_admin_or_service());

-- 9.8 Notifications & Price Alerts
DROP POLICY IF EXISTS "Notifications recipient only" ON core_notification;
CREATE POLICY "Notifications recipient only" ON core_notification FOR SELECT USING (recipient_id = get_current_app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "Notifications mark read" ON core_notification;
CREATE POLICY "Notifications mark read" ON core_notification FOR UPDATE USING (recipient_id = get_current_app_user_id()) WITH CHECK (recipient_id = get_current_app_user_id());

DROP POLICY IF EXISTS "Service notifications manage" ON core_notification;
CREATE POLICY "Service notifications manage" ON core_notification FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Price alerts owner only" ON core_pricealert;
CREATE POLICY "Price alerts owner only" ON core_pricealert FOR ALL USING (owner_id = get_current_app_user_id() OR is_admin_or_service());

-- =============================================================================
-- STEP 10: Storage Buckets & Policies
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('crop-photos', 'crop-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
        ON CONFLICT (id) DO UPDATE SET public = true;

        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('kyc-documents', 'kyc-documents', false, 15728640, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
        ON CONFLICT (id) DO UPDATE SET public = false;

        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('dispute-evidence', 'dispute-evidence', false, 20971520, ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'])
        ON CONFLICT (id) DO UPDATE SET public = false;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Crop photos public read" ON storage.objects;
        CREATE POLICY "Crop photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'crop-photos');

        DROP POLICY IF EXISTS "Authenticated users upload crop photos" ON storage.objects;
        CREATE POLICY "Authenticated users upload crop photos" ON storage.objects FOR INSERT WITH CHECK (
            bucket_id = 'crop-photos' AND auth.role() = 'authenticated'
        );

        DROP POLICY IF EXISTS "Users read own kyc documents" ON storage.objects;
        CREATE POLICY "Users read own kyc documents" ON storage.objects FOR SELECT USING (
            bucket_id = 'kyc-documents' AND (
                (storage.foldername(name))[1] = auth.uid()::text OR
                auth.role() = 'service_role' OR
                (SELECT role FROM core_user WHERE supabase_uid = auth.uid() LIMIT 1) IN ('ADMIN', 'INSTITUTION')
            )
        );

        DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
        CREATE POLICY "Users upload own kyc documents" ON storage.objects FOR INSERT WITH CHECK (
            bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

COMMIT;
