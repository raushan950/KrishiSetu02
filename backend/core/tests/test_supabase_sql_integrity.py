"""
Automated SQL Integrity, Schema Alignment, and Security Test Suite for Supabase.
Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery for Farmers.

Validates:
1. Complete model-to-table alignment between Django models and Supabase SQL schema.
2. Django infrastructure and migration tables inclusion (zero collision).
3. Supabase Auth integration (UUID foreign key, auth.users hook, privilege escalation prevention).
4. Security Definer functions search_path hijacking defense (CWE-426).
5. PostgREST defense-in-depth: Trading & financial immutability (orders, stock, payments).
6. Supabase Storage buckets and RLS policies (crop-photos, kyc-documents, dispute-evidence).
"""

import re
from pathlib import Path
import pytest
from django.apps import apps


BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
SCHEMA_SQL_PATH = BASE_DIR / "supabase" / "migrations" / "20261123_krishisetu_production_schema.sql"
RLS_SQL_PATH = BASE_DIR / "supabase" / "migrations" / "20261123_krishisetu_rls_policies.sql"


@pytest.fixture(scope="module")
def schema_sql():
    assert SCHEMA_SQL_PATH.exists(), f"Schema SQL file not found at {SCHEMA_SQL_PATH}"
    return SCHEMA_SQL_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def rls_sql():
    assert RLS_SQL_PATH.exists(), f"RLS SQL file not found at {RLS_SQL_PATH}"
    return RLS_SQL_PATH.read_text(encoding="utf-8")


class TestSchemaTableAlignment:
    """Verifies all Django models and framework tables are mapped in PostgreSQL schema."""

    def test_all_django_core_models_have_tables(self, schema_sql):
        core_models = list(apps.get_app_config("core").get_models())
        assert len(core_models) >= 25, f"Expected at least 25 core models, found {len(core_models)}"

        missing_tables = []
        for model in core_models:
            table_name = model._meta.db_table
            pattern = rf"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+{table_name}\b"
            if not re.search(pattern, schema_sql, re.IGNORECASE):
                missing_tables.append(table_name)

        assert not missing_tables, f"The following Django models are missing from Supabase schema: {missing_tables}"

    def test_django_framework_tables_present(self, schema_sql):
        required_framework_tables = [
            "django_content_type",
            "auth_permission",
            "auth_group",
            "auth_group_permissions",
            "django_migrations",
            "core_user_groups",
            "core_user_user_permissions",
            "django_session",
        ]
        for tbl in required_framework_tables:
            pattern = rf"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+{tbl}\b"
            assert re.search(pattern, schema_sql, re.IGNORECASE), f"Missing Django framework table: {tbl}"

    def test_django_migrations_prepopulated(self, schema_sql):
        # Verify that all migrations up through 0009 are pre-populated to avoid collision
        for mig_num in ["0001_initial", "0002_price_alert_payments", "0008_sold_out_inventory", "0009_user_supabase_uid"]:
            assert mig_num in schema_sql, f"Migration {mig_num} not registered in django_migrations pre-population"


class TestSupabaseAuthIntegration:
    """Verifies integration with Supabase Auth auth.users and account linking."""

    def test_core_user_supabase_uid_foreign_key(self, schema_sql):
        pattern = r"supabase_uid\s+UUID\s+UNIQUE\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL"
        assert re.search(pattern, schema_sql, re.IGNORECASE), "supabase_uid must be UUID referencing auth.users(id) ON DELETE SET NULL"

    def test_supabase_uid_indexed(self, schema_sql):
        assert "idx_core_user_supabase_uid" in schema_sql, "Index idx_core_user_supabase_uid missing"

    def test_auth_users_trigger_defined(self, rls_sql):
        assert "CREATE TRIGGER on_auth_user_created" in rls_sql, "Supabase auth.users signup trigger missing"
        assert "AFTER INSERT ON auth.users" in rls_sql, "Trigger must execute AFTER INSERT ON auth.users"

    def test_auth_users_handler_blocks_privilege_escalation(self, rls_sql):
        # Must whitelist roles to prevent a user from claiming ADMIN or INSTITUTION in metadata
        assert "v_role NOT IN ('FARMER', 'BUYER', 'TRANSPORTER')" in rls_sql, "Handler must block unauthorized roles like ADMIN"
        assert "v_role := 'FARMER';" in rls_sql, "Handler must fallback to default safe role"


class TestDatabaseFunctionSecurity:
    """Verifies PostgreSQL functions are immune to Search-Path Hijacking (CWE-426)."""

    def test_security_definer_functions_set_search_path(self, rls_sql):
        sec_def_matches = list(re.finditer(r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-zA-Z0-9_]+)\(.*?\)\s*RETURNS\s+.*?\s+SECURITY\s+DEFINER", rls_sql, re.DOTALL | re.IGNORECASE))
        assert len(sec_def_matches) >= 4, f"Expected at least 4 SECURITY DEFINER functions, found {len(sec_def_matches)}"

        for match in sec_def_matches:
            func_name = match.group(1)
            # Find the function definition body until the AS $$ block
            start_pos = match.start()
            end_pos = rls_sql.find("$$", start_pos)
            func_header = rls_sql[start_pos:end_pos]
            assert "SET search_path = public, pg_temp" in func_header or "SET search_path TO public, pg_temp" in func_header, (
                f"Function {func_name} marked SECURITY DEFINER without explicit 'SET search_path = public, pg_temp' (CWE-426 risk)"
            )

    def test_functions_revoke_public_execute(self, rls_sql):
        for func in ["get_current_app_user_id()", "get_current_app_user_role()", "is_admin_or_service()"]:
            pattern = rf"REVOKE\s+ALL\s+ON\s+FUNCTION\s+{re.escape(func)}\s+FROM\s+PUBLIC"
            assert re.search(pattern, rls_sql, re.IGNORECASE), f"Function {func} must revoke execute from PUBLIC"

    def test_get_current_app_user_id_uses_native_uuid(self, rls_sql):
        assert "supabase_uid = auth.uid()" in rls_sql, "get_current_app_user_id must compare UUID directly to auth.uid()"


class TestTradingImmutabilityAndRLS:
    """Verifies that direct PostgREST client queries cannot bypass trading constraints."""

    def test_all_26_core_tables_have_rls_enabled(self, rls_sql):
        core_models = apps.get_app_config("core").get_models()
        missing_rls = []
        for model in core_models:
            table_name = model._meta.db_table
            pattern = rf"ALTER\s+TABLE\s+{table_name}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;"
            if not re.search(pattern, rls_sql, re.IGNORECASE):
                missing_rls.append(table_name)
        assert not missing_rls, f"RLS not enabled on tables: {missing_rls}"

    def test_django_internal_tables_have_rls_enabled(self, rls_sql):
        for tbl in ["django_migrations", "django_session", "auth_permission", "core_user_groups"]:
            pattern = rf"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?{tbl}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;"
            assert re.search(pattern, rls_sql, re.IGNORECASE), f"RLS not enabled on Django internal table: {tbl}"

    def test_order_table_strictly_readonly_for_clients(self, rls_sql):
        # Verify that core_order only has SELECT for users, and write policies require service_role
        assert re.search(r'CREATE\s+POLICY\s+"[^"]+"\s+ON\s+core_order\s+FOR\s+SELECT', rls_sql, re.IGNORECASE), "core_order must have a SELECT policy for participants"
        
        # Ensure no client INSERT, UPDATE, or DELETE on core_order
        client_write_matches = re.findall(r'CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+core_order\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)', rls_sql, re.IGNORECASE)
        for policy_name, action in client_write_matches:
            # If action is ALL, verify it is restricted to service_role
            match_body = re.search(rf'CREATE\s+POLICY\s+"{re.escape(policy_name)}"\s+ON\s+core_order\s+FOR\s+{action}\s+USING\s*\((.*?)\);', rls_sql, re.DOTALL | re.IGNORECASE)
            if match_body:
                using_clause = match_body.group(1)
                assert "service_role" in using_clause, f"Client write allowed on core_order in policy {policy_name}: {using_clause}"

    def test_payments_and_settlements_strictly_service_role_for_writes(self, rls_sql):
        for table in ["core_paymentattempt", "core_paymentwebhookevent", "core_settlement", "core_refundrequest"]:
            matches = re.findall(rf'CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+{table}\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)', rls_sql, re.IGNORECASE)
            for policy_name, action in matches:
                match_body = re.search(rf'CREATE\s+POLICY\s+"{re.escape(policy_name)}"\s+ON\s+{table}\s+FOR\s+{action}\s+USING\s*\((.*?)\);', rls_sql, re.DOTALL | re.IGNORECASE)
                if match_body:
                    using_clause = match_body.group(1)
                    assert "service_role" in using_clause, f"Client write allowed on {table} in policy {policy_name}: {using_clause}"

    def test_offer_update_restricted_to_withdrawn(self, rls_sql):
        # Buyer can only withdraw their own pending offer; acceptance/counter must go through DRF
        pattern = r"status\s*=\s*'WITHDRAWN'"
        assert re.search(pattern, rls_sql), "core_offer client UPDATE must only allow WITHDRAWN status"

    def test_listing_insert_enforces_zero_reserve(self, rls_sql):
        pattern = r"reserved_qtl\s*=\s*0"
        assert re.search(pattern, rls_sql), "core_listing client INSERT must require reserved_qtl = 0"

    def test_shipment_event_is_append_only(self, rls_sql):
        assert re.search(r'CREATE\s+POLICY\s+"[^"]+"\s+ON\s+core_shipmentevent\s+FOR\s+INSERT', rls_sql, re.IGNORECASE), "Transporter must be able to append shipment event"
        
        # Verify no client UPDATE or DELETE on shipment event
        client_updates = re.findall(r'CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+core_shipmentevent\s+FOR\s+(UPDATE|DELETE)', rls_sql, re.IGNORECASE)
        for policy_name, action in client_updates:
            match_body = re.search(rf'CREATE\s+POLICY\s+"{re.escape(policy_name)}"\s+ON\s+core_shipmentevent\s+FOR\s+{action}\s+USING\s*\((.*?)\);', rls_sql, re.DOTALL | re.IGNORECASE)
            if match_body:
                using_clause = match_body.group(1)
                assert "service_role" in using_clause, f"Client {action} allowed on core_shipmentevent: {policy_name}"


class TestSupabaseStorageConfiguration:
    """Verifies that Supabase Storage buckets and security policies are created."""

    def test_storage_buckets_created(self, rls_sql):
        assert "crop-photos" in rls_sql, "crop-photos bucket creation missing"
        assert "kyc-documents" in rls_sql, "kyc-documents bucket creation missing"
        assert "dispute-evidence" in rls_sql, "dispute-evidence bucket creation missing"

    def test_kyc_and_dispute_buckets_are_private(self, rls_sql):
        # In rls_sql: kyc-documents has public = false
        pattern_kyc = r"'kyc-documents',\s*'kyc-documents',\s*false"
        pattern_dispute = r"'dispute-evidence',\s*'dispute-evidence',\s*false"
        assert re.search(pattern_kyc, rls_sql), "kyc-documents bucket must be private (public = false)"
        assert re.search(pattern_dispute, rls_sql), "dispute-evidence bucket must be private (public = false)"

    def test_storage_objects_policies_defined(self, rls_sql):
        assert "ON storage.objects" in rls_sql, "storage.objects RLS policies missing"
        assert "Crop photos public read" in rls_sql, "Public read policy on crop-photos missing"
        assert "Users read own kyc documents" in rls_sql, "Private user read policy on kyc-documents missing"
