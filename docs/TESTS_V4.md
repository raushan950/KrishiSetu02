# V4 verification evidence and limitations

These results describe checks that actually executed in the current authoring environment; integration tests **written** but not **executed** are never counted as passed.

- **Executed: 7/7 tests passed.** `python scripts/test_pure_engine.py`: normalizer, real-date validity, quality flags, arrivals unit conversion, stale/sparse forecast rejection, seven-day chronological forecast, negative net returns.
- **Executed: 38/38 source checks passed.** `python scripts/check_static.py`: deterministic finance and forecast calculations, route + migration manifest, configuration sanity.
- **Executed:** 49 Python files passed source compilation; 7 frontend JS/JSX files parsed with the Node TypeScript JSX parser (syntax only).
- **Not executable here:** Django system checks and Django TestCase suite (`ModuleNotFoundError: No module named django`); Django/DRF and PostgreSQL packages are not installed and package downloads are blocked.
- **Not executable here:** Vite React build (`sh: vite: not found`), browser E2E and Docker Compose because dependency installation and Docker are unavailable.
- **Not executed:** Live government import, payment and SMS/Google provider sandboxes, road routing and production deploy — require authorized credentials or infrastructure.

To verify with a configured system:

```bash
python scripts/test_pure_engine.py
python scripts/check_static.py
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
pytest -q core/tests
cd ../frontend
npm ci || npm install --no-audit --no-fund
npm run build
```

Run on **PostgreSQL**, not just SQLite, when validating stock and vehicle assignment concurrency. Add parallel API requests, load/security tests, mobile browser tests and document/file-scan validation before any pilot. For exact CI commands see `.github/workflows/checks.yml`.

Actual command outputs: `pure_test_results.txt`, `static_check_results.txt`, `django_runtime_attempt.txt`, `frontend_runtime_attempt.txt` in this directory. These numbers are *not* a completeness score and cannot establish deployment readiness.
