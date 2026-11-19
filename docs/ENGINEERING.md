# Architecture and engineering guide

## Architecture

A modular monolith, not microservices: React SPA -> versioned Django REST Framework API -> PostgreSQL. Django admin provides trusted back-office operations. Redis is configured for shared throttling cache; optional scheduled ingestion runs from a Compose profile, but a monitored asynchronous task queue is **not yet built**. PostgreSQL is the only intended production database. All price calculations use Python `Decimal`, and real-market records are kept separate from manual user assumptions.

Major model areas: `User`, `VerificationChallenge` (identity); `PriceAlert` (subscriptions); `PaymentAttempt`, `PaymentWebhookEvent` (gateway records); `Farm`, `Crop`, `Market`, `MandiPrice` (geography and provenance); `Listing`, `Offer`, `Order` (trade and inventory); `Vehicle`, `FreightRequest`, `FreightQuote`, `Shipment` (logistics); `Settlement` (manual declarations only); `Notification`, `AuditEvent` (communications and audit). Migrations: `backend/core/migrations/0001_initial.py` and `0002_price_alert_payments.py`.

## Authentication, roles and verification

- Public `/auth/register/` accepts farmer/buyer/transporter only. It creates an account with unverified email/phone and issues a real email challenge through the configured provider.
- JWT `/auth/login/` uses email/password, `/auth/refresh/` rotates refresh tokens, `/auth/logout/` blacklists a refresh token. Authenticated `/auth/change-password/` and email password reset revoke all outstanding refresh tokens. Other issued access tokens remain usable until expiry; there is no global session kill endpoint.
- `/auth/verification/request/` generates single-use email or phone challenge. The **nonsecret** `challenge_id` is returned to the currently authenticated user; email link embeds ID+secret, phone SMS carries secret. `/auth/verification/confirm/` submits `kind`, `challenge_id` and `token` and applies backend verification.
- Password reset follows Django's time-limited, state-dependent password reset tokens via email. Google identity login verifies signed Google ID tokens, audience, issuer, expiry and verified email. Existing-account Google linking requires already authenticated verified matching email.
- `email_verified`, `phone_verified`, `account_verified` (derived) and `identity_verified` are distinct; phone+email verification DOES NOT prove legal identity. Trading endpoints require an authorized role and verified email+phone. Institution/admin roles require privileged account creation via Django admin.
- Throttling requires a shared Redis cache when scaled beyond one process. Site-wide DRF limits and dedicated login/password-reset scopes apply. Challenge resends are serialized through user locks; invalid-code attempt counts persist when errors are returned. Adversarial and distributed-rate-limit testing is still needed.

## API quick reference

All routes below are under `/api/v1/` and exchange JSON unless uploading a crop image; use `Authorization: Bearer <access>`. Public routes indicated explicitly; other routes require logged-in credentials.

| Route | Method | Access / behavior |
|---|---|---|
| `auth/register/` | POST | Public, creates farmer/buyer/transporter |
| `auth/login/`, `auth/refresh/` | POST | Public, JWT obtain/refresh |
| `auth/google/` | POST | Public, requires Google ID credential + backend OAuth configuration |
| `auth/google/link/` | POST | Logged-in account link |
| `auth/logout/` | POST | Logged-in, invalidate refresh |
| `auth/me/` | GET, PATCH | Own profile; role/verified flags read-only |
| `auth/verification/request/`, `auth/verification/confirm/` | POST | Logged-in single-use verification |
| `auth/password-reset/request/`, `auth/password-reset/confirm/` | POST | Public email recovery |
| `crops/`, `markets/`, `prices/` | GET | Public paginated records, optional filters |
| `calculator/` | POST | Public decimal calculator |
| `recommendations/` | POST | Public mandi comparison; eligible direct offers require verified farmer auth |
| `assistant/` | POST | Signed-in deterministic source-backed assistant |
| `farms/`, `my-listings/` | GET, POST / GET | Farmer |
| `listings/` | GET, POST | Public GET, verified farmer POST |
| `offers/`, `offers/<id>/counter/`, `offers/<id>/accept/` | GET, POST | Buyers/farmers, verified trade |
| `orders/` | GET | Trade participants |
| `orders/<uuid>/cancel/` | POST (deprecated, returns 400) | One-sided cancellation deliberately blocked; use two-party `order-changes/` |
| `vehicles/` | GET, POST | Transporter |
| `freight/requests/`, `freight/quotes/`, `freight/quotes/<id>/assign/` | GET, POST | Eligible trade participants or transporters |
| `shipments/`, `shipments/<id>/update/` | GET, POST | Participants, milestones by assigned transporter |
| `settlements/` | GET, POST | Manual declarations by order participants |
| `notifications/` | GET, POST | Own alert list/mark read |
| `institutional/analytics/` | GET | Institution/admin only; aggregated |
| `auth/change-password/` | POST | Current + new password; revokes refresh tokens |
| `price-alerts/`, `price-alerts/<id>/` | GET, POST / DELETE | Own alerts; evaluated by command |
| `forecast/?crop=<id>&market=<id>` | GET | Public sparse-data-gated baseline |
| `payments/`, `payments/initiate/`, `payments/confirm/` | GET, POST, POST | Buyer/participant; callback is not capture |
| `payments/webhook/` | POST | Public HMAC-signed Razorpay webhook (provider only) |
| `status/` | GET | Public integration status |

### Net calculator request

```json
{"quantity_qtl":"20","price_per_qtl":"2500","loss_percent":"5","costs":{"transport":"1500","commission":"500"}}
```

Result includes `gross_inr`, `total_deductions_inr`, `net_inr`, `net_per_qtl_inr`, `net_per_kg_inr`, all numeric strings rounded for INR reporting; unit is INR, quantity unit is quintal (100 kg). Gross = `quantity_qtl * (1-loss_percent/100) * price_per_qtl`, net = gross minus sum of user supplied total-INR costs, not cost-per-quintal. Negative amounts remain negative. Unknown costs are **not inferred**.

### Destination comparison request

```json
{"crop_id":1,"quantity_qtl":"20","costs_by_destination":{"market:1":{"costs":{"transport":"1500","commission":"500"},"loss_percent":"1"}}}
```

Only latest quality-valid recorded price per market is ranked, along with eligible verified buyer offers for the farmer. Markets without cost maps are omitted and reported in `missing_cost_inputs`. The market reference is **not a binding offer**; date/source/freshness and assumptions are attached. This API currently assumes client knows all relevant cost inputs; no routing-derived distance or freight prices are inferred.

## Trade lifecycle

Buyer submits `Offer` -> farmer can counter -> other party can accept -> server transaction locks listing, verifies quantity and atomically reserves quantity -> `Order` created -> participant may request freight -> verified transporter quotes -> participant assigns -> transporter records milestones -> participant records manual settlement. A buyer may initiate a Razorpay gateway attempt (when configured); only an authenticated gateway webhook may mark it CAPTURED, which is still not bank settlement. The manual settlement endpoint refuses to mix with nonfailed gateway attempts. Refunds, bank reconciliation and payout automation remain absent.

## Test and security checklist

`pytest` covers calculation precision, login/registration role restrictions, email challenge creation, permissions, offer acceptance, buyer acceptance of farmer counteroffer, inventory reservation/release, and missing-cost handling. Tests include verification-attempt persistence, price-alert deduplication, callback versus capture, webhook rejection and event idempotency in addition to core trading checks; Django tests remain unexecuted in this environment. To assess concurrency, use PostgreSQL `TransactionTestCase` with separate database connections and race simulation. Add penetration tests, third-party dependency scanning, object storage/media malware scanning and API schema contract verification before any trial.

## Backup and recovery

Use encrypted, access-limited PostgreSQL backups and tested point-in-time recovery; include user-uploaded media/object storage separately. Backup example **after** configuring secure credentials on a trusted host:

```sh
pg_dump -Fc --no-owner "$DATABASE_URL" > krishisetu-YYYYMMDD.dump
pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" krishisetu-YYYYMMDD.dump
```

Do not use real backups on an exposed development machine; avoid storing secrets in commands/history. Define retention, deletion policy, recovery point objective and recovery time objective with operators; no automated backup job or successful restore verification is included in this baseline.


## v3 order and inventory invariants

1. Offer acceptance locks the listing and reserves the exact accepted `quantity_qtl`; it does not immediately consume goods.
2. Buyer-confirmed delivery acceptance atomically decreases `listing.quantity_qtl` and `listing.reserved_qtl`, and increments `order.accepted_qtl`. Carrier-reported arrival alone must not update inventory as a buyer acceptance.
3. Two-party cancellation of the entire unaccepted remainder releases corresponding stock. An accepted return increases `returned_qtl` **without automatically restocking** until a human verifies saleable condition.
4. For each order: `accepted_qtl + cancelled_qtl <= quantity_qtl`; `returned_qtl <= accepted_qtl`. Business flows guard these with row locks and validations.
5. A dispute freezes new acceptance and payment actions until an authorized administrator records a decision. Manual declarations are never bank receipts.
6. A refund request reserves its amount within captured payment limits. An admin sends one provider request; a webhook alone can confirm `PROCESSED`. A provider timeout is an unknown state needing manual reconciliation, not an instruction to retry.

New APIs: see README and the implementation matrix. `core/trade_resolution.py` and `core/intelligence.py` contain the specific boundaries.
