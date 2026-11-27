"""
Simulation & Integrity Test for Existing Supabase Database Non-Destructive Migration.
Problem Statement: SIH26132 - Strengthening Market Linkages and Price Discovery for Farmers.

Validates:
1. Read-only inspection queries syntax, security, and coverage of existing schema gaps.
2. Non-destructive reconciliation SQL (zero DROP TABLE, safe UUID conversion, proven migrations).
3. Privilege restoration boundaries (anon/authenticated receive only minimum read/insert grants, zero order/payment writes).
4. Security Definer search_path hygiene (CWE-426 defense).
5. Safe rollback script validity.
"""

import re
from pathlib import Path
import pytest
from django.db import connection
from django.db.migrations.loader import MigrationLoader


BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
INSPECTION_SQL_PATH = BASE_DIR / "supabase" / "migrations" / "20261123_inspection_queries.sql"
RECONCILE_SQL_PATH = BASE_DIR / "supabase" / "migrations" / "20261123_reconcile_existing_supabase.sql"
ROLLBACK_SQL_PATH = BASE_DIR / "supabase" / "migrations" / "20261123_rollback_migration.sql"


@pytest.fixture(scope="module")
def inspection_sql():
    assert INSPECTION_SQL_PATH.exists(), f"Inspection SQL missing at {INSPECTION_SQL_PATH}"
    return INSPECTION_SQL_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def reconcile_sql():
    assert RECONCILE_SQL_PATH.exists(), f"Reconcile SQL missing at {RECONCILE_SQL_PATH}"
    return RECONCILE_SQL_PATH.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def rollback_sql():
    assert ROLLBACK_SQL_PATH.exists(), f"Rollback SQL missing at {ROLLBACK_SQL_PATH}"
    return ROLLBACK_SQL_PATH.read_text(encoding="utf-8")


class TestInspectionQueries:
    """Verifies that inspection queries are strictly read-only and comprehensively inspect gaps."""

    def test_inspection_is_strictly_readonly(self, inspection_sql):
        destructive_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE"]
        for word in destructive_keywords:
            pattern = rf"\b{word}\b"
            assert not re.search(pattern, inspection_sql, re.IGNORECASE), f"Inspection query must not contain {word}"

    def test_inspection_covers_all_gaps(self, inspection_sql):
        assert "core_user_groups" in inspection_sql, "Inspection must check core_user_groups"
        assert "core_user_user_permissions" in inspection_sql, "Inspection must check core_user_user_permissions"
        assert "django_migrations" in inspection_sql, "Inspection must check django_migrations"
        assert "supabase_uid" in inspection_sql, "Inspection must check supabase_uid type and fk"
        assert "anon" in inspection_sql and "authenticated" in inspection_sql, "Inspection must check table grants"


class TestNonDestructiveReconciliationSQL:
    """Verifies that the reconciliation script safely updates existing database."""

    def test_zero_drop_tables(self, reconcile_sql):
        pattern = r"\bDROP\s+TABLE\b"
        assert not re.search(pattern, reconcile_sql, re.IGNORECASE), "Reconciliation SQL must NEVER DROP TABLES"

    def test_non_destructive_uuid_conversion(self, reconcile_sql):
        # Must alter column type with USING clause safely handling NULL or empty values
        assert "ALTER TABLE core_user" in reconcile_sql
        assert "ALTER COLUMN supabase_uid TYPE UUID" in reconcile_sql
        assert "USING" in reconcile_sql
        assert "auth.users(id)" in reconcile_sql, "Foreign key to auth.users(id) must be added"

    def test_missing_django_framework_tables_created(self, reconcile_sql):
        for tbl in [
            "django_content_type", "auth_permission", "auth_group", 
            "auth_group_permissions", "core_user_groups", "core_user_user_permissions", 
            "django_session", "django_admin_log", "django_migrations"
        ]:
            pattern = rf"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+{tbl}\b"
            assert re.search(pattern, reconcile_sql, re.IGNORECASE), f"Reconciliation must create missing table {tbl}"

    def test_proven_migration_history_insertion(self, reconcile_sql):
        # Every INSERT into django_migrations must be gated by WHERE EXISTS
        insert_blocks = re.findall(r"INSERT\s+INTO\s+django_migrations.*?WHERE\s+EXISTS\s+\(.*?\);", reconcile_sql, re.DOTALL | re.IGNORECASE)
        assert len(insert_blocks) >= 5, "Migrations must be proven by physical schema checks (WHERE EXISTS)"
        # Core 0009 must check that supabase_uid is uuid
        assert "column_name = 'supabase_uid' AND data_type = 'uuid'" in reconcile_sql, "0009 migration must assert uuid column existence"

    def test_privilege_restoration_boundaries(self, reconcile_sql):
        # Must grant USAGE and SELECT on core_crop, core_market, core_mandiprice
        assert "GRANT USAGE ON SCHEMA public TO anon, authenticated;" in reconcile_sql
        assert "GRANT SELECT ON core_crop, core_market, core_mandiprice TO anon, authenticated;" in reconcile_sql
        
        # Must NEVER grant INSERT/UPDATE/DELETE on orders or payments to anon/authenticated
        assert "REVOKE INSERT, UPDATE, DELETE ON" in reconcile_sql
        assert "core_order" in reconcile_sql
        assert "core_paymentattempt" in reconcile_sql
        assert "core_settlement" in reconcile_sql

    def test_security_definer_functions_protected(self, reconcile_sql):
        functions = ["get_current_app_user_id", "get_current_app_user_role", "is_admin_or_service", "handle_new_supabase_user"]
        for fn in functions:
            match = re.search(rf"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+{fn}\(.*?\).*?SECURITY\s+DEFINER\s+SET\s+search_path\s*=\s*public,\s*pg_temp", reconcile_sql, re.DOTALL | re.IGNORECASE)
            assert match, f"Function {fn} must be SECURITY DEFINER with explicit SET search_path = public, pg_temp"


class TestSafeRollbackSQL:
    """Verifies that rollback cleanly drops policies and functions without losing user data."""

    def test_rollback_does_not_drop_core_tables(self, rollback_sql):
        pattern = r"\bDROP\s+TABLE\b"
        assert not re.search(pattern, rollback_sql, re.IGNORECASE), "Rollback script must NOT drop any tables"

    def test_rollback_drops_functions_and_triggers(self, rollback_sql):
        assert "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;" in rollback_sql
        assert "DROP FUNCTION IF EXISTS handle_new_supabase_user();" in rollback_sql
        assert "DROP FUNCTION IF EXISTS is_admin_or_service();" in rollback_sql
        assert "DROP FUNCTION IF EXISTS get_current_app_user_id();" in rollback_sql

    def test_rollback_reverts_privileges(self, rollback_sql):
        assert "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;" in rollback_sql
