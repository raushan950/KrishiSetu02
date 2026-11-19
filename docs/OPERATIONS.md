# Operations: local setup, checks, backup and recovery

## Build/run

Use `cp .env.example .env` and replace every secret; `POSTGRES_PASSWORD` is intentionally mandatory rather than a hardcoded fallback. `docker compose up --build` builds the Django API, PostgreSQL, Redis and the static React frontend served by Nginx. The optional `scheduler` service is disabled by default via the `scheduled-ingestion` Compose profile. `/health/` checks DB reachability; `/api/v1/status/` discloses configured versus unavailable providers.

Before any deployment, run `python manage.py check --deploy` in an appropriate production-like environment, `python manage.py makemigrations --check --dry-run`, `python manage.py migrate`, `pytest -q`, `npm run build`, smoke tests and security scanning. Do NOT accept real merchant money before reconciled provider end-to-end tests and refunds have been implemented.

## OGD ingestion and alert evaluation

Obtain legitimate OGD resource access and verify its record fields/usage terms. Execute `python manage.py import_ogd --limit 100 --offset 0` with permitted credentials. `python manage.py evaluate_price_alerts` issues only database-grounded in-app alerts and deduplicates using the imported observation ID. `python manage.py ingest_and_alert` composes both actions, and the optional Compose scheduler runs it roughly every 24 hours. The scheduler loop is not a production-grade distributed queue or monitored batch system.

## Storage and logs

The Compose `pgdata` and `media` volumes are persistent only on the local host. Images are served publicly for listings. Production requires encrypted private object storage, scanning and retention policies. Use log scrubbing so provider credentials, OAuth tokens, OTP values, payment secrets and sensitive locations never appear in logs. Do not expose databases or Redis publicly.

## Database backup and restore

Create a secure location for encrypted daily dumps and verify uploads/media are backed up separately. Example from a host with the `pg_dump` tools and DATABASE_URL already securely injected:

```bash
umask 077
pg_dump -Fc --no-owner --dbname "$DATABASE_URL" -f "krishisetu-$(date +%Y%m%d-%H%M%S).dump"
```

On a **separate isolated restore instance**, with a specifically selected empty recovery database and its own access credentials:

```bash
pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL" "krishisetu-YYYYMMDD-HHMMSS.dump"
```

Confirm table counts, key owner/order relations, permissions and media references after restore. Restore execution and backup encryption have **not been tested**. Do not restore over an active production database. Define incident response, recovery objectives, retention and sensitive-data deletion before deployment.

## Gateway operations

Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` from an authorized merchant account. Register the webhook URL `https://<your-host>/api/v1/payments/webhook/`, with at minimum `payment.captured` and `payment.failed`. Verify webhook TLS and received signature before event processing. Gateway callback signature verification only reports `CALLBACK`; only a valid captured webhook changes a payment attempt to `CAPTURED`.

**CAPTURED is not bank settlement.** Merchant payout and bank credit require separate evidence, operator reconciliation and legal/business procedures. For failures, cancellations, disputes and chargebacks, use provider dashboards and competent financial oversight; this release does not automate refunds or payout reconciliation. Provider events may arrive out of order and should be tested for idempotency and error recovery in a sandbox before exposure.


## Backup and restore scripts (development; test before production)

- `scripts/backup_postgres.sh` uses `docker compose exec -T db pg_dump` to a timestamped local SQL file with restricted permissions. It requires a working Compose stack.
- `scripts/restore_postgres.sh <file.sql>` requires an explicit acknowledgement variable and should only be run against an isolated, empty restoration database. It does not replace professional encrypted off-site backups, retention plans or restoration tests.
- Run `python manage.py expire_offers` periodically; schedule official-source ingestion only after authorization.
- Staging gate: `python manage.py check --deploy`, `python manage.py makemigrations --check --dry-run`, PostgreSQL pytest, web asset build, TLS ingress, backup restore and provider webhook sandbox.
- Preserve audit logs; never record OTPs, gateway secrets, identity document numbers, private farm coordinates or other sensitive details in application logs.
