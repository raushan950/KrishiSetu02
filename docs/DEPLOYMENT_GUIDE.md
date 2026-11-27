# KrishiSetu Deployment and Operations Guide

This guide details both **100% Free-of-Cost Cloud Deployment (Render + Vercel + Supabase)** and production Docker deployment for the KrishiSetu platform.

---

## 0. Free-of-Cost Cloud Deployment (₹0 / $0 — No Credit Card Required)

The easiest zero-cost architecture uses **Supabase** (PostgreSQL + Auth + Storage), **Render.com** (Free Python/Gunicorn Backend + Optional Free Static Site), and **Vercel** (Optional Free Edge Frontend CDN):

### Option A: One-Click Full-Stack Deploy via Render Blueprint (`render.yaml`)
1. Push your latest repository changes to GitHub (`main` branch).
2. Open **[Render New Blueprint](https://dashboard.render.com/blueprint/new)** and connect your GitHub repository (`KrishiSetu02`).
3. Render reads [`render.yaml`](../render.yaml) and provisions both services for **$0/month**:
   - `krishisetu-api`: Free Python 3.12 Web Service running `gunicorn config.wsgi:application` with `/health/` checks.
   - `krishisetu-web`: Free Static Site running Vite build with SPA rewrite rules (`/* -> /index.html`), automatically wired to the backend via `VITE_API_HOST`.
4. Fill in your environment secrets when prompted by Render (from your local `.env`):
   - **Backend (`krishisetu-api`):** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GOOGLE_CLIENT_ID` (optional), `OGD_API_KEY` / `OGD_RESOURCE_ID` (optional).
   - **Frontend (`krishisetu-web`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID` (optional).
5. **Post-Deploy Google OAuth Note:** Add your live `https://krishisetu-web.onrender.com` origin under **Authorized JavaScript origins** in Google Cloud Console and **Redirect URLs** in Supabase Authentication Settings.

### Option B: Split Free Stack (Vercel Frontend + Render Backend + Supabase DB)
1. Deploy the backend via `render.yaml` (or New Web Service with `Root Directory: backend`, `Build Command: bash build.sh`, `Start Command: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 90`).
2. Import the repository on **Vercel** (`Root Directory: frontend`, `Framework Preset: Vite` — [`frontend/vercel.json`](../frontend/vercel.json) automatically handles React Router deep links).
3. Add Vercel Environment Variables:
   - `VITE_API_BASE_URL` = `https://<your-render-service>.onrender.com/api/v1/`
   - `VITE_SUPABASE_URL` = `<your-supabase-url>`
   - `VITE_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
   - `VITE_GOOGLE_CLIENT_ID` = `<your-google-client-id>` (optional)
4. On Render, update `FRONTEND_URL` to your `https://<your-app>.vercel.app` URL (note: `https://krishisetu*.vercel.app` and `https://krishisetu*.onrender.com` are also pre-permitted in `CORS_ALLOWED_ORIGIN_REGEXES`).

---

## 1. System Requirements

- **Operating System**: Linux (Ubuntu 22.04 LTS / Debian 12 recommended) or Windows Server
- **Container Runtime**: Docker Engine 24+ and Docker Compose v2+
- **Database**: Supabase PostgreSQL (or PostgreSQL 16+)
- **Cache**: Redis 7+ (for rate limiting and throttling)
- **Node.js**: Node 22+ (for frontend assets build)
- **Python**: Python 3.12+

---

## 2. Production Docker Architecture

The project includes production-ready Dockerfiles and `docker-compose.yml`:

```
                    [ Ingress / Nginx / Cloudflare TLS ]
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
        [ Frontend (Port 80) ]              [ Backend (Port 8000) ]
        Nginx Static Bundle                 Gunicorn WSGI (Django)
                 │                                   │
                 │                                   ├──► [ Supabase PostgreSQL ]
                 │                                   ├──► [ Redis Cache ]
                 └───────────────────────────────────┴──► [ Supabase Storage ]
```

### Services Defined:
1. `backend`: Gunicorn WSGI running Django REST Framework with security hardening.
2. `frontend`: High-performance Nginx container serving optimized Vite static bundle.
3. `db`: Local PostgreSQL 16 container for standalone development (replaced with Supabase PostgreSQL in staging/production via `DATABASE_URL`).
4. `redis`: Redis cache for rate limiting, login throttling, and verification cooldowns.
5. `scheduler`: Background market data ingestion worker running scheduled imports.

---

## 3. Environment Preparation

1. Clone or extract the repository:
   ```bash
   cd KrishiSetu
   ```

2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Populate production secrets in `.env`:
   - Set strong `DJANGO_SECRET_KEY` (minimum 50 random characters).
   - Set `DJANGO_DEBUG=0`.
   - Set `DJANGO_ALLOWED_HOSTS` to your production domain(s).
   - Set `DATABASE_URL` to your Supabase PostgreSQL connection string.
   - Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET`.
   - Set `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
   - Configure SMTP email credentials.

---

## 4. Deployment Execution

### Step 4.1: Build and Launch Containers
```bash
docker compose up --build -d
```

### Step 4.2: Apply Migrations
```bash
docker compose exec backend python manage.py migrate
```

### Step 4.3: Seed Agricultural Crop Catalog
Seeds standardized crop names (Wheat, Paddy, Mustard, Maize, Cotton, Onion, Potato, etc.) with **zero fabricated prices**:
```bash
docker compose exec backend python manage.py seed_crops
```

### Step 4.4: Create Superuser Administrator
```bash
docker compose exec backend python manage.py createsuperuser
```

### Step 4.5: Collect Static Assets
```bash
docker compose exec backend python manage.py collectstatic --noinput
```

---

## 5. Market Data Ingestion Pipeline

To import official Agmarknet mandi data via the authorized Open Government Data (OGD) API:

```bash
# Test single page import
docker compose exec backend python manage.py import_ogd --limit 100

# Full scheduled batch import
docker compose exec backend python manage.py import_ogd --all --limit 500 --max-pages 100

# Evaluate farmer price alert thresholds
docker compose exec backend python manage.py evaluate_price_alerts
```

Enable the automatic 24-hour scheduler container:
```bash
docker compose --profile scheduled-ingestion up -d scheduler
```

---

## 6. Health Checks and Monitoring

- **Application Health Endpoint**: `GET /health/` — verifies database connectivity and returns HTTP 200 `{"status": "ok", "database": "connected"}`.
- **Provider Status Endpoint**: `GET /api/v1/status/` — reports availability of email delivery, SMS OTP, payment gateways, and data sources.
- **Ingestion Monitor Endpoint**: `GET /api/v1/admin/import-monitor/` — admin-only operational log of recent ingestion runs, received counts, invalid flags, and errors.

---

## 7. Backup and Recovery Drill

### Database Backup
```bash
# For local container:
docker compose exec -T db pg_dump -U krishi krishisetu > backups/krishisetu_backup_$(date +%F).sql

# For Supabase PostgreSQL:
pg_dump "$DATABASE_URL" --format=custom --file=backups/krishisetu_supabase_$(date +%F).dump
```

### Database Restoration
```bash
# For Supabase PostgreSQL:
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" backups/krishisetu_supabase_<date>.dump
```

### Rollback Procedure
If a migration or deployment needs to be rolled back:
1. Revert container image to previous release tag.
2. Revert Django migration:
   ```bash
   python manage.py migrate core <previous_migration_number>
   ```
3. Restart backend service.
