> **Archived v3 audit:** For new v4 source, see [IMPLEMENTATION_V4.md](IMPLEMENTATION_V4.md) and [TESTS_V4.md](TESTS_V4.md). Earlier counts and completeness statements below reflect the prior revision.

# Execution record — 19 November 2026

These are results observed in the available authoring environment, not a substitute for integration, acceptance or production tests.

## Passed

1. `python -m compileall -q backend` — all 37 Python source files compiled (including initial and manually authored follow-up migrations and API test source).
2. `python scripts/check_static.py` — 31 decimal-calculation, forecast, API-path and configuration assertions passed.
3. Node TypeScript parser — all 6 frontend `.js`/`.jsx` files parsed with no syntax diagnostics. This is **not** a React/Vite build or browser execution.
4. ZIP/TAR package integrity and enumerated file verification — archived source can be extracted; no corrupted entries.

## Could not execute here

- `python backend/manage.py check`, `python backend/manage.py makemigrations --check --dry-run` and Django/pytest suites — **Django is not installed** (`ModuleNotFoundError: No module named 'django'`).
- `npm run build` and frontend test — **Vite dependencies are not installed**.
- Real PostgreSQL migrations, database concurrency and Docker Compose — required services are unavailable.
- Provider sandbox verification (SMTP, SMS, Google, market-data ingestion, ORS routes, payment capture/refunds, LLM), accessibility review, legal/privacy review and staging deployment — no authorized provider access or deployment.

## Reproduce on a provisioned system

Refer to the top-level `README.md` for environment variables and setup. With PostgreSQL and dependencies available, run:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
pytest
cd ../frontend
npm ci
npm run build
```

The repository includes a CI workflow, but its presence is not evidence that these commands passed. Do not claim production readiness until full results and external integration checks are recorded.
