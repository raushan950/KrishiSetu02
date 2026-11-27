-- =============================================================================
-- KrishiSetu (कृषिसेतु) Read-Only Schema & Permissions Inspection Queries
-- For Existing Supabase Project
-- Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery
-- Mode: STRICTLY READ-ONLY (Safe to execute; alters zero state and acquires no locks)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Check Existing Core Application Tables & Missing Django Framework Tables
-- -----------------------------------------------------------------------------
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'core_user', 'core_verificationchallenge', 'core_farm', 'core_crop',
        'core_market', 'core_mandiprice', 'core_marketimportrun', 'core_listing',
        'core_offer', 'core_order', 'core_vehicle', 'core_freightrequest',
        'core_freightquote', 'core_shipment', 'core_shipmentevent', 'core_deliveryacceptance',
        'core_orderchangerequest', 'core_tradedispute', 'core_paymentattempt',
        'core_paymentwebhookevent', 'core_refundrequest', 'core_settlement',
        'core_notification', 'core_auditevent', 'core_pricealert', 'core_emailchangechallenge',
        'django_migrations', 'django_content_type', 'auth_permission', 'auth_group',
        'auth_group_permissions', 'core_user_groups', 'core_user_user_permissions',
        'django_session', 'django_admin_log'
    ]) AS table_name
)
SELECT 
    rt.table_name,
    CASE WHEN pt.tablename IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status,
    COALESCE(pt.rowsecurity, FALSE) AS rls_enabled
FROM required_tables rt
LEFT JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = rt.table_name
ORDER BY status DESC, rt.table_name;


-- -----------------------------------------------------------------------------
-- 2. Inspect core_user.supabase_uid Column Data Type & Foreign Key Status
-- -----------------------------------------------------------------------------
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    tc.constraint_type,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu
    ON c.table_schema = kcu.table_schema
    AND c.table_name = kcu.table_name
    AND c.column_name = kcu.column_name
LEFT JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
    AND tc.constraint_type = 'FOREIGN KEY'
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE c.table_schema = 'public' 
  AND c.table_name = 'core_user' 
  AND c.column_name = 'supabase_uid';


-- -----------------------------------------------------------------------------
-- 3. Check Migration 0007 Integrity Constraints on Core Tables
-- -----------------------------------------------------------------------------
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('core_listing', 'core_order', 'core_freightquote', 'core_pricealert')
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;


-- -----------------------------------------------------------------------------
-- 4. Check Current Table Grants for anon and authenticated Roles
-- -----------------------------------------------------------------------------
SELECT 
    grantee,
    table_schema,
    table_name,
    string_agg(privilege_type, ', ') AS granted_privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name LIKE 'core_%'
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;


-- -----------------------------------------------------------------------------
-- 5. Inspect Existing PostgreSQL Functions (Search Path & Security Definer)
-- -----------------------------------------------------------------------------
SELECT 
    proname AS function_name,
    prosecdef AS is_security_definer,
    proconfig AS parameter_configuration,
    pg_get_userbyid(proowner) AS function_owner
FROM pg_proc
WHERE proname IN (
    'get_current_app_user_id', 
    'get_current_app_user_role', 
    'is_admin_or_service', 
    'handle_new_supabase_user'
)
ORDER BY proname;


-- -----------------------------------------------------------------------------
-- 6. Inspect Active Triggers on auth.users
-- -----------------------------------------------------------------------------
SELECT 
    event_object_schema,
    event_object_table,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';


-- -----------------------------------------------------------------------------
-- 7. Inspect Storage Buckets Status
-- -----------------------------------------------------------------------------
SELECT 
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types
FROM storage.buckets
WHERE id IN ('crop-photos', 'kyc-documents', 'dispute-evidence');
