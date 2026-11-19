# External integrations — configuration and truthfulness

| Dependency | Current implementation | Required to enable/validate | Disclosed state |
|---|---|---|---|
| OGD/Agmarknet mandi data | HTTP import command with validation/idempotence | Legitimate `OGD_API_KEY`, `OGD_RESOURCE_ID`, provider terms, schema/field verification, operational scheduling | Data unavailable until imported |
| Google OAuth/OpenID Connect | Backend validates Google ID token and supports secure linked accounts | `GOOGLE_CLIENT_ID`, authorized JavaScript origins, frontend Google Identity Services widget, domain verification as required | Backend-configurable, UI incomplete |
| Email verification and recovery | Real Django send_mail + single-use email challenges | SMTP host/user/password, approved sender/domain/SPF/DKIM, real delivery tests | Dev console/SMTP configured only |
| Phone OTP | Backend-generated and HMAC-hashed code, provider-guarded SMS | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, SMS regulatory requirements and tests | Disabled until provider connected |
| Payments | Razorpay Orders API adapter, checkout UI, signed callback, HMAC webhook, stored payment attempts and deduplicated events | Authorized merchant account, sandbox capture tests, reconciliation, refund and payout procedures, compliance review | `CONFIGURED_NOT_VERIFIED` or `UNAVAILABLE` |
| Transport road distance | NOT BUILT | Authorized routing provider and accurate regional road coverage | `NOT_IMPLEMENTED` |
| Real-time GPS | NOT BUILT | Authorized vehicle tracker infrastructure and opt-in data governance | `NOT_IMPLEMENTED` |
| LLM market assistant | Deterministic observations-only fallback | Grounded retrieval pipeline, provider keys, prompt-injection testing, sourcing and disclosure | `DETERMINISTIC_FALLBACK` |
| Statistical forecasting | Conservative 7-day median baseline, chronological 7-observation MAE; minimum 30 observations over 60 days | Multi-season backtesting, calibration, operational crop-specific validation | `BASELINE_MODEL_REQUIRES_HISTORY` |
| Push/WhatsApp alerts | In-app notifications only | Approved provider plus preference/consent handling | `NOT_IMPLEMENTED` |
| Cloud storage / CDN | Local media volume in development | Private object store, malware scanning, expiring signed access and retention | Development only |
| Government institution | Aggregated dashboard and administrator role | Written permissions, security review, procurement/compliance agreements | No official affiliation |

## Setup hints

**Google:** Register a web OAuth client in Google Cloud, restrict authorized origins/redirect URIs, set `GOOGLE_CLIENT_ID` in Django. Google Identity Services loads on the login/register page when the configured public client ID is reported by the backend; the ID token is sent to `POST auth/google/` as `credential`. Backend creation defaults to farmer (requires phone verification before trading); user role selection for Google creation is unfinished. Verify only in a real authorized sandbox.

**SMTP:** Set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`, and `FRONTEND_URL`. Console mail is only for local development, not proof of verified inbox control. Verify provider receipts and bounced-message handling.

**Twilio:** Set `SMS_PROVIDER=twilio`, account credentials and approved sender. Endpoint `/auth/verification/request/` returns challenge UUID to the already authenticated caller while the code is sent via SMS. The user submits `kind=PHONE`, `challenge_id` and received six-digit code. No permanent plaintext code storage, and no SMS may be falsely reported as sent when the provider is unconfigured. Review Indian messaging and template rules with your provider.

**Government data:** Obtain access to authorized resource data with date/commodity/market/price field shapes matching the importer. CLI `python manage.py import_ogd --limit 100 --offset 0`. Validate record mapping and legal reuse conditions with authoritative documentation. The importer handles one page per command. `ingest_and_alert` invokes ingestion followed by deduplicated price alerts; a development-only Compose scheduler profile can run it daily, but it is not a monitored distributed worker. Plan replay/provenance sampling, import dashboards and anomaly review before public use.

Do not use sample provider secrets from `.env.example` for live deployment. Provider access/certification and DPDPA/privacy applicability must be verified with competent legal and security specialists; no certification is claimed.


## Razorpay merchant configuration (integration code, not a verified live feature)

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Never place the latter two in frontend environment variables. Use an authorized isolated test-mode merchant account before considering real funds. The frontend starts checkout with a backend-created provider order. On browser callback, the backend verifies the `order_id|payment_id` HMAC and records `CALLBACK` **without implying capture**. The public `/api/v1/payments/webhook/` handler checks the HMAC over the **raw request body**, deduplicates `X-Razorpay-Event-Id`, validates order ID, currency, amount and captured status, then marks `CAPTURED`. No escrow, refund API, reconciliation or bank payout proof exists.

Official references: [Razorpay Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [Razorpay webhooks](https://razorpay.com/docs/webhooks/). Independent live testing and provider approval are pending.


## Added optional providers and refund status

`ORS_API_KEY` enables POST `/routing/road/` using Openrouteservice driving-car GeoJSON API. The client submits owned farm ID and market ID (never arbitrary other users' exact locations). The response is provider road distance/duration, **not** a freight quote. Missing coordinates, keys or routes return unavailable without straight-line substitution. Official documentation: https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types

`MARKET_LLM_PROVIDER=openai`, `OPENAI_API_KEY` and `OPENAI_MODEL` configure optional assistant narration through the OpenAI Responses API. All price facts and numeric ranked calculations remain server-derived. Narration is explicitly nonauthoritative; vendor outages fall back to a deterministic answer. No LLM token or secrets are bundled.

Razorpay refunds are created using the merchant-side `POST /v1/payments/:id/refund` endpoint **only** after authorized admin review of a `CAPTURED` payment. Refund success is recognized only from a matching signed `refund.processed` webhook. Provider timeouts remain `PROVIDER_PENDING` for manual merchant reconciliation; do not submit the request twice. Official Razorpay API documentation: https://razorpay.com/docs/api/refunds/ and refund events: https://razorpay.com/docs/webhooks/refunds/

Google, SMS, SMTP, OGD, ORS, LLM and payment integrations require authorized credentials and individual sandbox tests before any operational claims.
