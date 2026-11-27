-- =============================================================================
-- KrishiSetu (कृषिसेतु) Production PostgreSQL Schema for Supabase
-- Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery
-- Authoritative Schema: Aligned with Django Models & Migrations (0001 through 0009)
-- Verified & Hardened: 2026-11-23
-- =============================================================================

-- Enable required cryptographic and UUID extensions in Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 0. Django Framework & Auth Infrastructure Tables
-- Ensures zero conflicts when Django's migration engine connects to Supabase
-- -----------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS django_migrations (
    id BIGSERIAL PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- 1. User and Profile Identity Table (Aligned with core.User)
-- Integrates directly with Supabase auth.users(id) via UUID foreign key
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_user (
    id BIGSERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMPTZ,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(16) UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'FARMER' CHECK (role IN ('FARMER', 'BUYER', 'TRANSPORTER', 'ADMIN', 'INSTITUTION')),
    google_sub VARCHAR(150) UNIQUE,
    supabase_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'hi',
    district VARCHAR(100) NOT NULL DEFAULT '',
    state VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_core_user_supabase_uid ON core_user(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_core_user_email ON core_user(email);
CREATE INDEX IF NOT EXISTS idx_core_user_role ON core_user(role);

-- Django User Many-to-Many Relationships
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

-- Django Session Table
CREATE TABLE IF NOT EXISTS django_session (
    session_key VARCHAR(40) PRIMARY KEY,
    session_data TEXT NOT NULL,
    expire_date TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS django_session_expire_date_a5c62663 ON django_session(expire_date);

-- SimpleJWT Blacklist Infrastructure
CREATE TABLE IF NOT EXISTS token_blacklist_outstandingtoken (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES core_user(id) DEFERRABLE INITIALLY DEFERRED,
    jti VARCHAR(255) NOT NULL UNIQUE,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS token_blacklist_blacklistedtoken (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL UNIQUE REFERENCES token_blacklist_outstandingtoken(id) DEFERRABLE INITIALLY DEFERRED,
    blacklisted_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. Verification Challenges (Email & SMS OTP)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_verificationchallenge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('EMAIL', 'PHONE')),
    digest VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempts SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS core_verificati_509831_idx ON core_verificationchallenge(user_id, kind, created_at);

-- -----------------------------------------------------------------------------
-- 3. Farms and Agricultural Catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_farm (
    id BIGSERIAL PRIMARY KEY,
    farmer_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    village VARCHAR(120) NOT NULL DEFAULT '',
    district VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS core_farm_farmer_id_idx ON core_farm(farmer_id);

CREATE TABLE IF NOT EXISTS core_crop (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    hindi_name VARCHAR(100) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS core_market (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(140) NOT NULL,
    district VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    CONSTRAINT unique_market_region UNIQUE (name, district, state)
);

-- -----------------------------------------------------------------------------
-- 4. Authentic Mandi Prices with Source Provenance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_mandiprice (
    id BIGSERIAL PRIMARY KEY,
    market_id BIGINT NOT NULL REFERENCES core_market(id) ON DELETE RESTRICT,
    crop_id BIGINT NOT NULL REFERENCES core_crop(id) ON DELETE RESTRICT,
    variety VARCHAR(100) NOT NULL DEFAULT '',
    grade VARCHAR(80) NOT NULL DEFAULT '',
    min_price NUMERIC(13, 2) NOT NULL,
    max_price NUMERIC(13, 2) NOT NULL,
    modal_price NUMERIC(13, 2) NOT NULL,
    arrival_qtl NUMERIC(15, 3),
    unit VARCHAR(20) NOT NULL DEFAULT 'INR/quintal',
    observed_on DATE NOT NULL,
    source VARCHAR(100) NOT NULL,
    source_record_id VARCHAR(200) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    quality_status VARCHAR(10) NOT NULL DEFAULT 'VALID' CHECK (quality_status IN ('VALID', 'FLAGGED')),
    quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT unique_price_source_record UNIQUE (source, source_record_id),
    CONSTRAINT non_negative_prices CHECK (min_price >= 0 AND max_price >= 0 AND modal_price >= 0)
);
CREATE INDEX IF NOT EXISTS core_mandiprice_f8173f_idx ON core_mandiprice(crop_id, observed_on);
CREATE INDEX IF NOT EXISTS core_mandiprice_f0f2c8_idx ON core_mandiprice(market_id, observed_on);

-- -----------------------------------------------------------------------------
-- 5. Market Import Runs (Operational Audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_marketimportrun (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(60) NOT NULL,
    resource_id VARCHAR(140) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    finished_at TIMESTAMPTZ,
    pages_count INTEGER NOT NULL DEFAULT 0,
    received_count INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    unchanged_count INTEGER NOT NULL DEFAULT 0,
    invalid_count INTEGER NOT NULL DEFAULT 0,
    flagged_count INTEGER NOT NULL DEFAULT 0,
    error VARCHAR(400) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS market_import_started_idx ON core_marketimportrun(started_at DESC);

-- -----------------------------------------------------------------------------
-- 6. Farmer Listings and Trading Engine
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_listing (
    id BIGSERIAL PRIMARY KEY,
    farmer_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    farm_id BIGINT REFERENCES core_farm(id) ON DELETE RESTRICT,
    crop_id BIGINT NOT NULL REFERENCES core_crop(id) ON DELETE RESTRICT,
    variety VARCHAR(100) NOT NULL DEFAULT '',
    grade VARCHAR(100) NOT NULL DEFAULT '',
    quantity_qtl NUMERIC(14, 3) NOT NULL,
    reserved_qtl NUMERIC(14, 3) NOT NULL DEFAULT 0,
    asking_per_qtl NUMERIC(13, 2) NOT NULL,
    district VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image VARCHAR(100) NOT NULL DEFAULT '',
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT valid_inventory CHECK (
        (quantity_qtl > 0 AND reserved_qtl >= 0 AND reserved_qtl <= quantity_qtl) OR
        (quantity_qtl = 0 AND reserved_qtl = 0 AND status = 'CLOSED')
    )
);
CREATE INDEX IF NOT EXISTS core_listing_farmer_id_idx ON core_listing(farmer_id);
CREATE INDEX IF NOT EXISTS core_listing_crop_id_idx ON core_listing(crop_id);

CREATE TABLE IF NOT EXISTS core_offer (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT NOT NULL REFERENCES core_listing(id) ON DELETE RESTRICT,
    buyer_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    proposed_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    parent_id BIGINT REFERENCES core_offer(id) ON DELETE RESTRICT,
    quantity_qtl NUMERIC(14, 3) NOT NULL,
    price_per_qtl NUMERIC(13, 2) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT positive_offer_amounts CHECK (quantity_qtl > 0 AND price_per_qtl > 0)
);
CREATE INDEX IF NOT EXISTS core_offer_99676d_idx ON core_offer(listing_id, status);
CREATE INDEX IF NOT EXISTS core_offer_buyer_id_idx ON core_offer(buyer_id);

CREATE TABLE IF NOT EXISTS core_order (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_id BIGINT NOT NULL UNIQUE REFERENCES core_offer(id) ON DELETE RESTRICT,
    listing_id BIGINT NOT NULL REFERENCES core_listing(id) ON DELETE RESTRICT,
    farmer_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    buyer_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    quantity_qtl NUMERIC(14, 3) NOT NULL,
    price_per_qtl NUMERIC(13, 2) NOT NULL,
    accepted_qtl NUMERIC(14, 3) NOT NULL DEFAULT 0,
    cancelled_qtl NUMERIC(14, 3) NOT NULL DEFAULT 0,
    returned_qtl NUMERIC(14, 3) NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'DISPATCHED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'CANCELLED', 'DISPUTED', 'RETURNED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT valid_order_quantities CHECK (
        quantity_qtl > 0 AND accepted_qtl >= 0 AND cancelled_qtl >= 0 AND returned_qtl >= 0 AND
        accepted_qtl <= (quantity_qtl - cancelled_qtl) AND
        returned_qtl <= accepted_qtl
    )
);
CREATE INDEX IF NOT EXISTS core_order_farmer_id_idx ON core_order(farmer_id);
CREATE INDEX IF NOT EXISTS core_order_buyer_id_idx ON core_order(buyer_id);

-- -----------------------------------------------------------------------------
-- 7. Logistics and Transportation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_vehicle (
    id BIGSERIAL PRIMARY KEY,
    transporter_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    registration VARCHAR(30) NOT NULL UNIQUE,
    vehicle_type VARCHAR(80) NOT NULL,
    capacity_qtl NUMERIC(12, 2) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT positive_vehicle_capacity CHECK (capacity_qtl > 0)
);

CREATE TABLE IF NOT EXISTS core_freightrequest (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE REFERENCES core_order(id) ON DELETE RESTRICT,
    pickup_location VARCHAR(240) NOT NULL,
    dropoff_location VARCHAR(240) NOT NULL,
    pickup_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS core_freightquote (
    id BIGSERIAL PRIMARY KEY,
    freight_request_id BIGINT NOT NULL REFERENCES core_freightrequest(id) ON DELETE RESTRICT,
    transporter_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    vehicle_id BIGINT NOT NULL REFERENCES core_vehicle(id) ON DELETE RESTRICT,
    price_inr NUMERIC(13, 2) NOT NULL,
    message VARCHAR(240) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_transporter_freight_quote UNIQUE (freight_request_id, transporter_id),
    CONSTRAINT positive_freight_price CHECK (price_inr > 0)
);

CREATE TABLE IF NOT EXISTS core_shipment (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE REFERENCES core_order(id) ON DELETE RESTRICT,
    quote_id BIGINT NOT NULL UNIQUE REFERENCES core_freightquote(id) ON DELETE RESTRICT,
    status VARCHAR(14) NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED')),
    evidence_note TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS core_shipmentevent (
    id BIGSERIAL PRIMARY KEY,
    shipment_id BIGINT NOT NULL REFERENCES core_shipment(id) ON DELETE RESTRICT,
    status VARCHAR(14) NOT NULL CHECK (status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED')),
    actor_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    note VARCHAR(1000) NOT NULL DEFAULT '',
    evidence VARCHAR(100) NOT NULL DEFAULT '',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_shipment_milestone UNIQUE (shipment_id, status)
);
CREATE INDEX IF NOT EXISTS shipment_event_timeline_idx ON core_shipmentevent(shipment_id, recorded_at);

-- -----------------------------------------------------------------------------
-- 8. Post-Trade Casework (Acceptances, Changes, Disputes, Refunds)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_deliveryacceptance (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES core_order(id) ON DELETE RESTRICT,
    quantity_qtl NUMERIC(14, 3) NOT NULL,
    accepted_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    evidence_note VARCHAR(1000) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT positive_delivery_acceptance CHECK (quantity_qtl > 0)
);

CREATE TABLE IF NOT EXISTS core_orderchangerequest (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES core_order(id) ON DELETE RESTRICT,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('CANCEL_REMAINDER', 'RETURN')),
    quantity_qtl NUMERIC(14, 3) NOT NULL,
    proposed_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    responded_by_id BIGINT REFERENCES core_user(id) ON DELETE RESTRICT,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    responded_at TIMESTAMPTZ,
    CONSTRAINT positive_order_change_quantity CHECK (quantity_qtl > 0)
);

CREATE TABLE IF NOT EXISTS core_tradedispute (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES core_order(id) ON DELETE RESTRICT,
    opened_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    category VARCHAR(60) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
    previous_order_status VARCHAR(24) NOT NULL,
    resolution_note TEXT NOT NULL DEFAULT '',
    decided_by_id BIGINT REFERENCES core_user(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    resolved_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 9. Payments, Settlements, and Webhooks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_paymentattempt (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES core_order(id) ON DELETE RESTRICT,
    gateway_order_id VARCHAR(100) NOT NULL UNIQUE,
    gateway_payment_id VARCHAR(100) NOT NULL DEFAULT '',
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(10) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'CALLBACK', 'CAPTURED', 'FAILED')),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT positive_payment_amount CHECK (amount_paise > 0)
);

CREATE TABLE IF NOT EXISTS core_paymentwebhookevent (
    id BIGSERIAL PRIMARY KEY,
    gateway_event_id VARCHAR(128) NOT NULL UNIQUE,
    event_name VARCHAR(80) NOT NULL,
    body_sha256 VARCHAR(64) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS core_refundrequest (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES core_order(id) ON DELETE RESTRICT,
    payment_id BIGINT NOT NULL REFERENCES core_paymentattempt(id) ON DELETE RESTRICT,
    requested_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    decided_by_id BIGINT REFERENCES core_user(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'PROVIDER_PENDING', 'PROCESSED', 'REJECTED', 'FAILED')),
    gateway_refund_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT positive_refund_amount CHECK (amount_paise > 0)
);

CREATE TABLE IF NOT EXISTS core_settlement (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE REFERENCES core_order(id) ON DELETE RESTRICT,
    amount_inr NUMERIC(16, 2) NOT NULL,
    reference VARCHAR(120) NOT NULL DEFAULT '',
    status VARCHAR(12) NOT NULL DEFAULT 'DECLARED' CHECK (status IN ('DECLARED', 'RECONCILED')),
    declared_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE RESTRICT,
    declared_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    acknowledged_by_id BIGINT REFERENCES core_user(id) ON DELETE RESTRICT,
    acknowledged_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 10. Notifications, Alerts, and Audit Logging
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_notification (
    id BIGSERIAL PRIMARY KEY,
    recipient_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    message VARCHAR(300) NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS core_auditevent (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES core_user(id) ON DELETE SET NULL,
    event VARCHAR(100) NOT NULL,
    object_id VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS core_pricealert (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    crop_id BIGINT NOT NULL REFERENCES core_crop(id) ON DELETE CASCADE,
    market_id BIGINT REFERENCES core_market(id) ON DELETE CASCADE,
    threshold_per_qtl NUMERIC(13, 2) NOT NULL,
    direction VARCHAR(5) NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_notified_price_id BIGINT REFERENCES core_mandiprice(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT positive_alert_threshold CHECK (threshold_per_qtl > 0)
);

CREATE TABLE IF NOT EXISTS core_emailchangechallenge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    new_email VARCHAR(254) NOT NULL,
    digest VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    used_at TIMESTAMPTZ,
    attempts SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS core_emchg_user_created_idx ON core_emailchangechallenge(user_id, created_at);

-- -----------------------------------------------------------------------------
-- 11. Initial Migration State Registration
-- Marks core migrations as applied so Django manage.py migrate recognizes them
-- -----------------------------------------------------------------------------
INSERT INTO django_migrations (app, name, applied)
VALUES 
    ('contenttypes', '0001_initial', now()),
    ('contenttypes', '0002_remove_content_type_name', now()),
    ('auth', '0001_initial', now()),
    ('auth', '0002_alter_permission_name_max_length', now()),
    ('auth', '0003_alter_user_email_max_length', now()),
    ('auth', '0004_alter_user_username_opts', now()),
    ('auth', '0005_alter_user_last_login_null', now()),
    ('auth', '0006_require_contenttypes_0002', now()),
    ('auth', '0007_alter_validators_add_error_messages', now()),
    ('auth', '0008_alter_user_username_max_length', now()),
    ('auth', '0009_alter_user_last_name_max_length', now()),
    ('auth', '0010_alter_group_name_max_length', now()),
    ('auth', '0011_update_proxy_permissions', now()),
    ('auth', '0012_alter_user_first_name_max_length', now()),
    ('core', '0001_initial', now()),
    ('core', '0002_price_alert_payments', now()),
    ('core', '0003_trade_resolution', now()),
    ('core', '0004_email_change', now()),
    ('core', '0005_market_import_monitoring', now()),
    ('core', '0006_shipment_event', now()),
    ('core', '0007_trade_integrity_checks', now()),
    ('core', '0008_sold_out_inventory', now()),
    ('core', '0009_user_supabase_uid', now()),
    ('sessions', '0001_initial', now()),
    ('token_blacklist', '0001_initial', now()),
    ('token_blacklist', '0002_outstandingtoken_jti_hex', now()),
    ('token_blacklist', '0003_auto_20171017_2007', now()),
    ('token_blacklist', '0004_auto_20171017_2013', now()),
    ('token_blacklist', '0005_remove_outstandingtoken_jti', now()),
    ('token_blacklist', '0006_auto_20171017_2113', now()),
    ('token_blacklist', '0007_auto_20171017_2214', now()),
    ('token_blacklist', '0008_migrate_to_bigautofield', now()),
    ('token_blacklist', '0010_fix_migrate_to_bigautofield', now()),
    ('token_blacklist', '0011_linearizes_history', now()),
    ('token_blacklist', '0012_alter_outstandingtoken_user', now()),
    ('token_blacklist', '0013_alter_blacklistedtoken_options_and_more', now())
ON CONFLICT DO NOTHING;
