> **Archived v3 audit:** For new v4 source, see [IMPLEMENTATION_V4.md](IMPLEMENTATION_V4.md) and [TESTS_V4.md](TESTS_V4.md). Earlier counts and completeness statements below reflect the prior revision.

# KrishiSetu implementation and release audit — 19 November 2026

**Classification: expanded development source, not a completed production platform, not government-approved, and not verified for real money.** Source-code availability is not the same as working end-to-end software.

## Evidence-based state

| Capability | Source present? | Runtime verified here? | External gate / outstanding requirement |
|---|---|---|---|
| Django/DRF API, PostgreSQL models, 0001–0004 migrations | Yes | Python syntax only | Django checks, actual PostgreSQL migration, rollback, performance |
| Email/password registration, verified-email links and account recovery | Yes | No | Authorized SMTP sandbox/live test, security and browser review |
| Mobile OTP and Google OIDC | Adapters and UI present | No | Provider accounts, callbacks, region-level testing |
| Verified email change and refresh-session revocation | Yes | No | Test delivery/replay/concurrent account changes and browser lifecycle |
| Mandi importer and provenance | Yes | No live import | Authorized OGD key/resource access, schema validation and freshness audits |
| Financial calculator and destination ranking | Yes | Standalone math checks | Real fees/rates validated with farmers and market authorities |
| Farm/listings and photo upload | Yes | No | Object storage, upload malware/security scanning, browser accessibility |
| Offers, counteroffers, reject/withdraw/expire | Yes | No | PostgreSQL concurrency tests and real account onboarding |
| Inventory reservation, buyer-confirmed partial acceptance | Yes | No | Race/stress tests; independent physical proof not implemented |
| Two-party remainder cancellation and returns | Yes | No | Legal/business rules, transport reversals and physical return verification |
| Disputes and administrator review | Yes | No | Human dispute procedure, appeal and data retention policies |
| Vehicles, freight quotes, carrier assignment, shipment events | Yes | No | Carrier onboarding, document vetting, evidence uploads, insurance |
| Openrouteservice road distances | Adapter and UI present | No | Valid ORS key, route availability/limits, location consent |
| Gateway capture via signed webhook | Yes | Standalone HMAC check only | Merchant approval, signed sandbox event tests, bank reconciliation |
| Admin-approved refunds via provider API and signed webhook | Yes | No | Gateway sandbox, idempotency/retry process and payment compliance |
| Manual settlement and counterparty acknowledgement | Yes | No | This is **never** bank settlement proof |
| Price history, alerts and baseline forecast | Yes | Standalone baseline checks | Licensed history data, seasonal backtesting, calibrated uncertainty |
| Grounded assistant with optional external LLM narration | Yes | No | LLM credentials and evaluation, hallucination and injection review |
| Institutional aggregates and CSV download | Yes | No | Privacy and aggregation thresholds, permissions review |
| Multilingual and accessible experience | Partial | No | Full English/Hindi/Punjabi translations, screenreader/mobile usability |
| CI, Compose, health check, backup scripts | Yes | Static inspection only | Build CI and staging; backup/restore exercise, monitoring and TLS |

## Checks actually executed by authoring environment

- Parsed and compiled all 37 Python source files (including migration and test source).
- Parsed all 6 JavaScript/JSX source files with the TypeScript parser.
- Executed 31 standalone assertions for decimal financial calculations, explicit invalid-input rejection, baseline forecasting, route registration and configuration.
- Produced integrity-tested ZIP and TAR.GZ source archives. Full command evidence is in `docs/CHECK_RESULTS.md`.

**Could not run** `manage.py check`, `makemigrations --check`, PostgreSQL migrations, `pytest`, `npm run build`, browser E2E, Docker Compose, payment or SMS/email sandbox flows, live data imports or deployment: their required packages and infrastructure are not available in this authoring container. New Django API test source is included but is NOT a passing test report.

## Known release blockers

1. **NO GO for real farmers, financial transactions or institutional/government pilots.** A completed source implementation requires provider testing, legal approvals and independent security assessments before launch.
2. Manual confirmation, counterparty agreement, physical return and carrier milestones are *recorded declarations*; they do not establish that a crop moved or funds settled.
3. Refund API requests may time out after reaching a gateway. They become `PROVIDER_PENDING` and **must be reconciled with the merchant portal**, not blindly retried. A signed matching `refund.processed` webhook is required for provider-confirmed success.
4. An unconfigured external provider is explicitly unavailable (no fake SMS codes, market quotes, routes, settlements or prices).
5. Browser development sessions currently use `sessionStorage`. Adopt reviewed HttpOnly cookies/BFF, CSRF and CSP before any internet-facing deployment.
6. The importer is an adaptable OGD source client, not an active government connection or guarantee of comprehensive mandi coverage. Road distance requires coordinates and ORS access.
7. Production object storage, document scanning, authorized KYC procedures, live GPS, multilingual audits, independent ML validation, reconciliation automation, encrypted backup restore and incident drills remain outstanding.
8. Business continuity: financial disputes, return evidence and legal consumer/refund obligations require expert approval.

## Next independent gates

On a machine with internet access, Python/Node and PostgreSQL, follow `README.md`, run `python manage.py check`, `python manage.py makemigrations --check --dry-run`, migrations, PostgreSQL-backed `pytest`, `npm run build` and browser tests. Obtain real provider sandbox accounts for SMTP/SMS/Google/OGD/routing/Razorpay/LLM. Then conduct an accessibility review, external security audit, backup restore drill, professional agricultural unit-economics assessment and supervised staging rollout.

No official affiliation, government endorsement, certified compliance, escrow services, calibrated forecast or production financial settlement is claimed.
