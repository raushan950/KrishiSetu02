-- =============================================================================
-- KrishiSetu (कृषिसेतु) Row Level Security (RLS) Policies & Storage for Supabase
-- Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery
-- Authoritative Model Alignment: Django 5.2 & Supabase Auth Security Baseline
-- Generated, Hardened & Audited: 2026-11-23
-- =============================================================================

-- =============================================================================
-- SECTION 0: Enable RLS on All Application & Internal System Tables
-- =============================================================================

-- Core Application Tables (26 tables)
ALTER TABLE core_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_verificationchallenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_farm ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_crop ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_market ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_mandiprice ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_marketimportrun ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_listing ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_offer ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_freightrequest ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_freightquote ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_shipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_shipmentevent ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_deliveryacceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_orderchangerequest ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_tradedispute ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_paymentattempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_paymentwebhookevent ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_refundrequest ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_settlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_auditevent ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_pricealert ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_emailchangechallenge ENABLE ROW LEVEL SECURITY;

-- Django Framework Infrastructure Tables (Zero PostgREST leakage)
ALTER TABLE IF EXISTS django_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS django_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS django_content_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS core_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS core_user_user_permissions ENABLE ROW LEVEL SECURITY;

-- Protect Django internal tables from any anon / authenticated client access
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service django_migrations" ON django_migrations;
    CREATE POLICY "Service django_migrations" ON django_migrations FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service django_session" ON django_session;
    CREATE POLICY "Service django_session" ON django_session FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service django_content_type" ON django_content_type;
    CREATE POLICY "Service django_content_type" ON django_content_type FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service auth_permission" ON auth_permission;
    CREATE POLICY "Service auth_permission" ON auth_permission FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service auth_group" ON auth_group;
    CREATE POLICY "Service auth_group" ON auth_group FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service auth_group_permissions" ON auth_group_permissions;
    CREATE POLICY "Service auth_group_permissions" ON auth_group_permissions FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service core_user_groups" ON core_user_groups;
    CREATE POLICY "Service core_user_groups" ON core_user_groups FOR ALL USING (auth.role() = 'service_role');
    
    DROP POLICY IF EXISTS "Service core_user_user_permissions" ON core_user_user_permissions;
    CREATE POLICY "Service core_user_user_permissions" ON core_user_user_permissions FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN OTHERS THEN
    -- Continue if some django auth tables are deferred
    NULL;
END $$;


-- =============================================================================
-- SECTION 1: Secure Helper Functions (Zero Search-Path Hijacking CWE-426)
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
-- SECTION 2: Supabase Auth Hook (Privilege Escalation Protection CWE-269)
-- Automatically synchronizes Supabase auth.users signups with core_user
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
    -- Whitelist allowed self-registered roles to prevent privilege escalation
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
        -- Link existing Django account to the Supabase Auth UUID
        UPDATE core_user 
        SET supabase_uid = NEW.id,
            email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, email_verified)
        WHERE id = v_existing_id;
    ELSE
        -- Insert a new application profile linked to Supabase UID
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
            '!', -- Unusable raw password (authentication handled via Supabase)
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
-- SECTION 3: Mandi Market Intelligence & Reference Data (Public Read)
-- =============================================================================

-- Crop Catalog
DROP POLICY IF EXISTS "Public crops read" ON core_crop;
CREATE POLICY "Public crops read" ON core_crop
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin crops manage" ON core_crop;
CREATE POLICY "Admin crops manage" ON core_crop
    FOR ALL USING (is_admin_or_service());

-- Market Mandis
DROP POLICY IF EXISTS "Public markets read" ON core_market;
CREATE POLICY "Public markets read" ON core_market
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin markets manage" ON core_market;
CREATE POLICY "Admin markets manage" ON core_market
    FOR ALL USING (is_admin_or_service());

-- Mandi Prices (Public read for valid prices, strictly service_role for writes)
DROP POLICY IF EXISTS "Public valid mandi prices read" ON core_mandiprice;
CREATE POLICY "Public valid mandi prices read" ON core_mandiprice
    FOR SELECT USING (quality_status = 'VALID' OR is_admin_or_service());

DROP POLICY IF EXISTS "Service mandi prices write" ON core_mandiprice;
CREATE POLICY "Service mandi prices write" ON core_mandiprice
    FOR ALL USING (auth.role() = 'service_role');

-- Ingestion Run Auditing
DROP POLICY IF EXISTS "Admin import runs view" ON core_marketimportrun;
CREATE POLICY "Admin import runs view" ON core_marketimportrun
    FOR SELECT USING (is_admin_or_service());

DROP POLICY IF EXISTS "Service import runs manage" ON core_marketimportrun;
CREATE POLICY "Service import runs manage" ON core_marketimportrun
    FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- SECTION 4: User Profiles & Farms
-- =============================================================================

DROP POLICY IF EXISTS "Users read own profile" ON core_user;
CREATE POLICY "Users read own profile" ON core_user
    FOR SELECT USING (supabase_uid = auth.uid() OR is_admin_or_service());

DROP POLICY IF EXISTS "Users update own profile" ON core_user;
CREATE POLICY "Users update own profile" ON core_user
    FOR UPDATE USING (supabase_uid = auth.uid())
    WITH CHECK (
        supabase_uid = auth.uid() AND
        role = (SELECT role FROM core_user WHERE id = get_current_app_user_id()) AND
        is_staff = FALSE AND
        is_superuser = FALSE
    );

DROP POLICY IF EXISTS "Service user manage" ON core_user;
CREATE POLICY "Service user manage" ON core_user
    FOR ALL USING (auth.role() = 'service_role');

-- Verification & Email Challenges (Strictly Backend Service Role)
DROP POLICY IF EXISTS "Service verificationchallenge manage" ON core_verificationchallenge;
CREATE POLICY "Service verificationchallenge manage" ON core_verificationchallenge
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service emailchangechallenge manage" ON core_emailchangechallenge;
CREATE POLICY "Service emailchangechallenge manage" ON core_emailchangechallenge
    FOR ALL USING (auth.role() = 'service_role');

-- Farms (Farmer managed)
DROP POLICY IF EXISTS "Farmers manage own farms" ON core_farm;
CREATE POLICY "Farmers manage own farms" ON core_farm
    FOR ALL USING (farmer_id = get_current_app_user_id() OR is_admin_or_service());


-- =============================================================================
-- SECTION 5: Trading Engine, Listings, Offers & Atomic Orders
-- =============================================================================

-- Listings
DROP POLICY IF EXISTS "Active listings readable" ON core_listing;
CREATE POLICY "Active listings readable" ON core_listing
    FOR SELECT USING (status = 'ACTIVE' OR farmer_id = get_current_app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "Farmers insert listing" ON core_listing;
CREATE POLICY "Farmers insert listing" ON core_listing
    FOR INSERT WITH CHECK (
        farmer_id = get_current_app_user_id() AND
        reserved_qtl = 0
    );

DROP POLICY IF EXISTS "Farmers update own listing" ON core_listing;
CREATE POLICY "Farmers update own listing" ON core_listing
    FOR UPDATE USING (
        farmer_id = get_current_app_user_id()
    ) WITH CHECK (
        farmer_id = get_current_app_user_id() AND
        reserved_qtl = (SELECT l.reserved_qtl FROM core_listing l WHERE l.id = core_listing.id)
    );

DROP POLICY IF EXISTS "Service listing manage" ON core_listing;
CREATE POLICY "Service listing manage" ON core_listing
    FOR ALL USING (auth.role() = 'service_role');

-- Offers (Negotiation Protocol)
DROP POLICY IF EXISTS "Offers visible to buyer and farmer" ON core_offer;
CREATE POLICY "Offers visible to buyer and farmer" ON core_offer
    FOR SELECT USING (
        buyer_id = get_current_app_user_id() OR
        EXISTS (SELECT 1 FROM core_listing l WHERE l.id = listing_id AND l.farmer_id = get_current_app_user_id()) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Buyers insert pending offer" ON core_offer;
CREATE POLICY "Buyers insert pending offer" ON core_offer
    FOR INSERT WITH CHECK (
        buyer_id = get_current_app_user_id() AND
        proposed_by_id = get_current_app_user_id() AND
        status = 'PENDING'
    );

-- Buyers can withdraw their own pending offer. Acceptances/counteroffers MUST go via Django API.
DROP POLICY IF EXISTS "Buyers withdraw own offer" ON core_offer;
CREATE POLICY "Buyers withdraw own offer" ON core_offer
    FOR UPDATE USING (
        buyer_id = get_current_app_user_id() AND
        status = 'PENDING'
    ) WITH CHECK (
        buyer_id = get_current_app_user_id() AND
        status = 'WITHDRAWN'
    );

DROP POLICY IF EXISTS "Service offer manage" ON core_offer;
CREATE POLICY "Service offer manage" ON core_offer
    FOR ALL USING (auth.role() = 'service_role');

-- Orders (Authoritative Trading Record: STRICTLY Read-Only for Clients)
DROP POLICY IF EXISTS "Orders visible to participants" ON core_order;
CREATE POLICY "Orders visible to participants" ON core_order
    FOR SELECT USING (
        farmer_id = get_current_app_user_id() OR
        buyer_id = get_current_app_user_id() OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service orders manage" ON core_order;
CREATE POLICY "Service orders manage" ON core_order
    FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- SECTION 6: Post-Trade Casework & Dispute Governance
-- =============================================================================

-- Delivery Acceptance
DROP POLICY IF EXISTS "Delivery acceptances visible to order participants" ON core_deliveryacceptance;
CREATE POLICY "Delivery acceptances visible to order participants" ON core_deliveryacceptance
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service delivery acceptances manage" ON core_deliveryacceptance;
CREATE POLICY "Service delivery acceptances manage" ON core_deliveryacceptance
    FOR ALL USING (auth.role() = 'service_role');

-- Order Change Requests
DROP POLICY IF EXISTS "Order changes visible to participants" ON core_orderchangerequest;
CREATE POLICY "Order changes visible to participants" ON core_orderchangerequest
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service order changes manage" ON core_orderchangerequest;
CREATE POLICY "Service order changes manage" ON core_orderchangerequest
    FOR ALL USING (auth.role() = 'service_role');

-- Trade Disputes
DROP POLICY IF EXISTS "Disputes visible to participants" ON core_tradedispute;
CREATE POLICY "Disputes visible to participants" ON core_tradedispute
    FOR SELECT USING (
        opened_by_id = get_current_app_user_id() OR
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Participants open dispute" ON core_tradedispute;
CREATE POLICY "Participants open dispute" ON core_tradedispute
    FOR INSERT WITH CHECK (
        opened_by_id = get_current_app_user_id() AND
        status = 'OPEN' AND
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id()))
    );

DROP POLICY IF EXISTS "Admin disputes resolve" ON core_tradedispute;
CREATE POLICY "Admin disputes resolve" ON core_tradedispute
    FOR ALL USING (is_admin_or_service());

-- Refund Requests (Strictly Read-Only for Clients, writes via Django Service Role)
DROP POLICY IF EXISTS "Refund requests visible to participants" ON core_refundrequest;
CREATE POLICY "Refund requests visible to participants" ON core_refundrequest
    FOR SELECT USING (
        requested_by_id = get_current_app_user_id() OR
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service refunds manage" ON core_refundrequest;
CREATE POLICY "Service refunds manage" ON core_refundrequest
    FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- SECTION 7: Logistics, Vehicles, Quotes & Shipments
-- =============================================================================

-- Vehicles
DROP POLICY IF EXISTS "Transporter vehicles manage" ON core_vehicle;
CREATE POLICY "Transporter vehicles manage" ON core_vehicle
    FOR ALL USING (transporter_id = get_current_app_user_id() OR is_admin_or_service());

-- Freight Requests
DROP POLICY IF EXISTS "Freight requests visible to transporters and parties" ON core_freightrequest;
CREATE POLICY "Freight requests visible to transporters and parties" ON core_freightrequest
    FOR SELECT USING (
        get_current_app_user_role() IN ('TRANSPORTER', 'ADMIN', 'INSTITUTION') OR
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id()))
    );

DROP POLICY IF EXISTS "Service freight requests manage" ON core_freightrequest;
CREATE POLICY "Service freight requests manage" ON core_freightrequest
    FOR ALL USING (auth.role() = 'service_role');

-- Freight Quotes
DROP POLICY IF EXISTS "Freight quotes visible to transporter and farmer" ON core_freightquote;
CREATE POLICY "Freight quotes visible to transporter and farmer" ON core_freightquote
    FOR SELECT USING (
        transporter_id = get_current_app_user_id() OR
        EXISTS (
            SELECT 1 FROM core_freightrequest fr
            JOIN core_order o ON o.id = fr.order_id
            WHERE fr.id = freight_request_id AND o.farmer_id = get_current_app_user_id()
        ) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Transporters submit freight quotes" ON core_freightquote;
CREATE POLICY "Transporters submit freight quotes" ON core_freightquote
    FOR INSERT WITH CHECK (
        transporter_id = get_current_app_user_id()
    );

DROP POLICY IF EXISTS "Service freight quotes manage" ON core_freightquote;
CREATE POLICY "Service freight quotes manage" ON core_freightquote
    FOR ALL USING (auth.role() = 'service_role');

-- Shipments
DROP POLICY IF EXISTS "Shipments visible to parties and carrier" ON core_shipment;
CREATE POLICY "Shipments visible to parties and carrier" ON core_shipment
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        EXISTS (SELECT 1 FROM core_freightquote fq WHERE fq.id = quote_id AND fq.transporter_id = get_current_app_user_id()) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service shipments manage" ON core_shipment;
CREATE POLICY "Service shipments manage" ON core_shipment
    FOR ALL USING (auth.role() = 'service_role');

-- Shipment Events (Append-Only Audit Trail)
DROP POLICY IF EXISTS "Shipment events visible to parties" ON core_shipmentevent;
CREATE POLICY "Shipment events visible to parties" ON core_shipmentevent
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM core_shipment s
            JOIN core_order o ON o.id = s.order_id
            WHERE s.id = shipment_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())
        ) OR
        actor_id = get_current_app_user_id() OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Transporters append shipment events" ON core_shipmentevent;
CREATE POLICY "Transporters append shipment events" ON core_shipmentevent
    FOR INSERT WITH CHECK (
        actor_id = get_current_app_user_id() AND
        EXISTS (
            SELECT 1 FROM core_shipment s
            JOIN core_freightquote fq ON fq.id = s.quote_id
            WHERE s.id = shipment_id AND fq.transporter_id = get_current_app_user_id()
        )
    );

DROP POLICY IF EXISTS "Service shipment events manage" ON core_shipmentevent;
CREATE POLICY "Service shipment events manage" ON core_shipmentevent
    FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- SECTION 8: Payments, Webhooks & Financial Settlements (Service-Role Orchestrated)
-- =============================================================================

-- Payment Attempts
DROP POLICY IF EXISTS "Payment attempts visible to order parties" ON core_paymentattempt;
CREATE POLICY "Payment attempts visible to order parties" ON core_paymentattempt
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service payment attempts manage" ON core_paymentattempt;
CREATE POLICY "Service payment attempts manage" ON core_paymentattempt
    FOR ALL USING (auth.role() = 'service_role');

-- Webhook Events (Strictly Zero Client Access)
DROP POLICY IF EXISTS "Webhooks service only" ON core_paymentwebhookevent;
CREATE POLICY "Webhooks service only" ON core_paymentwebhookevent
    FOR ALL USING (auth.role() = 'service_role');

-- Financial Settlements
DROP POLICY IF EXISTS "Settlements visible to order parties" ON core_settlement;
CREATE POLICY "Settlements visible to order parties" ON core_settlement
    FOR SELECT USING (
        declared_by_id = get_current_app_user_id() OR
        acknowledged_by_id = get_current_app_user_id() OR
        EXISTS (SELECT 1 FROM core_order o WHERE o.id = order_id AND (o.farmer_id = get_current_app_user_id() OR o.buyer_id = get_current_app_user_id())) OR
        is_admin_or_service()
    );

DROP POLICY IF EXISTS "Service settlements manage" ON core_settlement;
CREATE POLICY "Service settlements manage" ON core_settlement
    FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- SECTION 9: Notifications, Price Alerts & Audit Trails
-- =============================================================================

-- Notifications
DROP POLICY IF EXISTS "Notifications recipient only" ON core_notification;
CREATE POLICY "Notifications recipient only" ON core_notification
    FOR SELECT USING (recipient_id = get_current_app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "Notifications mark read" ON core_notification;
CREATE POLICY "Notifications mark read" ON core_notification
    FOR UPDATE USING (recipient_id = get_current_app_user_id())
    WITH CHECK (recipient_id = get_current_app_user_id());

DROP POLICY IF EXISTS "Service notifications manage" ON core_notification;
CREATE POLICY "Service notifications manage" ON core_notification
    FOR ALL USING (auth.role() = 'service_role');

-- Price Alerts
DROP POLICY IF EXISTS "Price alerts owner only" ON core_pricealert;
CREATE POLICY "Price alerts owner only" ON core_pricealert
    FOR ALL USING (owner_id = get_current_app_user_id() OR is_admin_or_service());

-- Audit Events (Strictly Admin / Service Read, Service-Only Write)
DROP POLICY IF EXISTS "Audit events admin view" ON core_auditevent;
CREATE POLICY "Audit events admin view" ON core_auditevent
    FOR SELECT USING (is_admin_or_service());

DROP POLICY IF EXISTS "Service audit events manage" ON core_auditevent;
CREATE POLICY "Service audit events manage" ON core_auditevent
    FOR ALL USING (auth.role() = 'service_role');


-- =============================================================================
-- SECTION 10: Supabase Storage Buckets & Access Control Policies
-- =============================================================================

-- Create standard storage buckets if storage schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        -- 1. Public Crop Photos Bucket
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('crop-photos', 'crop-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
        ON CONFLICT (id) DO UPDATE SET public = true;

        -- 2. Private KYC Documents Bucket (Controlled Signed URLs)
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('kyc-documents', 'kyc-documents', false, 15728640, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
        ON CONFLICT (id) DO UPDATE SET public = false;

        -- 3. Private Dispute Evidence Bucket (Controlled Signed URLs)
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('dispute-evidence', 'dispute-evidence', false, 20971520, ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'])
        ON CONFLICT (id) DO UPDATE SET public = false;
    END IF;
END $$;

-- Storage Objects Policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Crop Photos Policies
        DROP POLICY IF EXISTS "Crop photos public read" ON storage.objects;
        CREATE POLICY "Crop photos public read" ON storage.objects
            FOR SELECT USING (bucket_id = 'crop-photos');

        DROP POLICY IF EXISTS "Authenticated users upload crop photos" ON storage.objects;
        CREATE POLICY "Authenticated users upload crop photos" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'crop-photos' AND
                auth.role() = 'authenticated'
            );

        -- KYC Documents Policies (Private: Owner and Admin only)
        DROP POLICY IF EXISTS "Users read own kyc documents" ON storage.objects;
        CREATE POLICY "Users read own kyc documents" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'kyc-documents' AND (
                    (storage.foldername(name))[1] = auth.uid()::text OR
                    auth.role() = 'service_role' OR
                    (SELECT role FROM core_user WHERE supabase_uid = auth.uid() LIMIT 1) IN ('ADMIN', 'INSTITUTION')
                )
            );

        DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
        CREATE POLICY "Users upload own kyc documents" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'kyc-documents' AND
                (storage.foldername(name))[1] = auth.uid()::text
            );

        -- Dispute Evidence Policies
        DROP POLICY IF EXISTS "Dispute evidence visible to authorized parties" ON storage.objects;
        CREATE POLICY "Dispute evidence visible to authorized parties" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'dispute-evidence' AND (
                    auth.role() = 'service_role' OR
                    (SELECT role FROM core_user WHERE supabase_uid = auth.uid() LIMIT 1) IN ('ADMIN', 'INSTITUTION') OR
                    auth.role() = 'authenticated'
                )
            );

        DROP POLICY IF EXISTS "Authenticated upload dispute evidence" ON storage.objects;
        CREATE POLICY "Authenticated upload dispute evidence" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'dispute-evidence' AND
                auth.role() = 'authenticated'
            );
    END IF;
END $$;
