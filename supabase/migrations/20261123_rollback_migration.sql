-- =============================================================================
-- KrishiSetu (कृषिसेतु) Rollback Script for Reconciliation Migration
-- Specifically for EXISTING Supabase Database
-- Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery
-- Mode: SAFE ROLLBACK (Preserves all core_ application data)
-- =============================================================================

BEGIN;

-- 1. Remove auth trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_supabase_user();

-- 2. Remove helper functions
DROP FUNCTION IF EXISTS is_admin_or_service();
DROP FUNCTION IF EXISTS get_current_app_user_role();
DROP FUNCTION IF EXISTS get_current_app_user_id();

-- 3. Drop storage policies if they were created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Crop photos public read" ON storage.objects;
        DROP POLICY IF EXISTS "Authenticated users upload crop photos" ON storage.objects;
        DROP POLICY IF EXISTS "Users read own kyc documents" ON storage.objects;
        DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
    END IF;
END $$;

-- 4. Revert table permissions on public schema to fully locked down state
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 5. Drop RLS policies created during reconciliation
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND policyname IN (
            'Public crops read', 'Admin crops manage',
            'Public markets read', 'Admin markets manage',
            'Public valid mandi prices read', 'Service mandi prices write',
            'Users read own profile', 'Users update own profile', 'Service user manage',
            'Active listings readable', 'Farmers insert listing', 'Farmers update own listing', 'Service listing manage',
            'Offers visible to buyer and farmer', 'Buyers insert pending offer', 'Buyers withdraw own offer', 'Service offer manage',
            'Orders visible to participants', 'Service orders manage',
            'Payment attempts visible to order parties', 'Service payment attempts manage',
            'Webhooks service only',
            'Settlements visible to order parties', 'Service settlements manage',
            'Transporter vehicles manage',
            'Freight requests visible to transporters and parties', 'Service freight requests manage',
            'Freight quotes visible to transporter and farmer', 'Transporters submit freight quotes', 'Service freight quotes manage',
            'Shipments visible to parties and carrier', 'Service shipments manage',
            'Shipment events visible to parties', 'Transporters append shipment events', 'Service shipment events manage',
            'Disputes visible to participants', 'Participants open dispute', 'Admin disputes resolve',
            'Notifications recipient only', 'Notifications mark read', 'Service notifications manage',
            'Price alerts owner only',
            'Service django_migrations'
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 6. Note on tables and foreign keys:
-- Table structures (django_*, core_user_groups, etc.) are kept intact so no user data is lost.
-- core_user.supabase_uid UUID foreign key remains safe and intact.

COMMIT;
