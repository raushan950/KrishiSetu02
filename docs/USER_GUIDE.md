# Role-based user and administrator guide

## Farmer

1. Register with email, Indian +91 phone, password and farmer role. Verify email from the received link and SMS from the authorized provider. If SMS is unavailable, trading features are gated and **not simulated**.
2. Browse recorded prices by crop and state. Always check price observation date, source and freshness. A mandi modal price is **not** a guaranteed purchase price.
3. Calculate expected net revenue using quantity (quintals), expected price, crop loss and applicable total-INR cost assumptions. Compare selected recorded destinations only after entering realistic transport and other expenses; there is no automatic map-routing estimate.
4. Publish crop listing with quantity, location and asking price; farmer data stored in profile/farm records should be limited to what is necessary. View offers in My account. Accept or negotiate via API. Order stock is reserved transactionally when an offer is accepted.
5. Freight requests, shipment monitoring and manual settlement recording are supported by API. Their farmer/buyer frontend screens remain to be completed.

## Buyer

1. Register and verify email and phone. Browse real farmer listings and submit offers for available quantities.
2. Find offers in My account. Offers proposed by farmers as counters may be accepted by buyers through API; buyer counteroffer UI remains incomplete.
3. Follow orders, coordinate freight and settlements through API; actual bank payment integration is absent.

## Transporter

1. Register with transporter role and verify email/phone. In Transporter workspace register vehicle with capacity and registration; an authorized administrator must verify it first.
2. View freight requests and submit quotes for verified eligible vehicles.
3. On assignment, record pickup, transit, and delivery milestones. There is no location/GPS telemetry and the platform should not imply it exists.

## Administrator

1. Provision trusted admin/staff users using Django `createsuperuser` on a secured system; never allow public admin enrollment.
2. In `/admin/`, manage crop catalogues, authorized market data, suspicious records, vehicle review, users, role grants, manual settlement review and audit logs. Verify real evidence before changing `identity_verified` or vehicle `verified`.
3. Configure providers and check `/api/v1/status/` for infrastructure state. Configure real data imports and inspect provenance/record freshness. Do not insert fake price data to populate dashboards.
4. Audit permissions, uploads, import anomalies, backups, operational incidents and pending disputes. This baseline has no full dispute workflow or unified admin review queue.

## Institutional user

1. An administrator provisions the institution role; self-signup cannot grant it.
2. Access `/institution` and `/api/v1/institutional/analytics/` to review aggregate crop prices, observation counts and overall participation/transaction totals. No personally identifying farmer record exports are supported. Introduce statistical disclosure controls before sharing small aggregates outside a trusted institution.

## Accessible service expectations

The responsive frontend provides labeled fields and basic English/Hindi/Punjabi navigational copy. Full multi-language translations, assisted-voice experience, WCAG audit, field-usability tests with farmers and low-bandwidth performance benchmarks are not completed.

## Additional current workflows and boundaries

- **Farmers:** In *My account → Farms*, create farm records. In *Marketplace*, publish a real crop listing with an optional JPEG/PNG/WebP photo (maximum 5 MB). Use *Offers* to accept or counter a buyer's proposal. In *Orders*, request freight, compare transporter quotations and view shipment status. Estimate costs under *Compare net return*; specify transportation, all additional charges and loss before trusting a ranking.
- **Buyers:** Use *Marketplace* to make offers. Under *My account → Offers*, accept farmer counteroffers or counter again; under *Orders* view status, request freight and, only when a merchant gateway is enabled, launch a payment checkout. A signed checkout callback is **not evidence of captured money**; a gateway webhook must confirm capture.
- **Transporters:** Submit a vehicle for administrator verification. Verified accounts and vehicles may provide freight quotations and update assigned shipment milestones.
- **Alerts and forecasts:** Farmers and buyers can create alert thresholds under *My account → Price alerts*. These require scheduled real imports and notify in-app; SMS/push alerts are not active. *Forecast* shows a seven-day historical median baseline only when 30 distinct dated observations span at least 60 days, with non-calibrated uncertainty disclosed.
- **Account security:** Email verification is required after sign-up. Real phone verification needs an approved SMS provider. *Security* permits a password change, which revokes outstanding refresh tokens; existing access tokens expire normally. Google buttons are shown only with a configured OAuth client.
- **Administrator:** Use Django admin to create trusted catalogue entries and review vehicles, verification flags and audit events. The institutional dashboard is aggregated and must not be used as a substitute for authorization/privacy policy.

**No live market price or payment verification is claimed by this source package.** Production provider onboarding, legal permissions and full testing are separate required steps.


## Additional user flows (v3)

Farmer: In **My account → My listings**, edit remaining stock or close a listing. Stock cannot be reduced below reserved quantities. In **trade resolution**, propose cancellation of unaccepted quantity or a return of accepted produce; the other party must approve. A returned crop is not immediately put back on sale.

Buyer: In **trade resolution**, confirm received quantity, using the farmgate checkbox only when actual direct handover occurred. Carrier arrival alone is not buyer acceptance. Use a dispute for quality/payment concerns and wait for authorized administration. Captured payment refunds require separately submitted and approved requests.

Farmer/buyer: In **orders**, record manual payments only after quantities are buyer accepted. The other party may acknowledge the manual record; this does not confirm bank settlement.

Administrator: The **Admin queue** handles pending vehicle reviews, disputes and refund decisions. Review actual evidence before approving vehicles. **Submit to gateway** triggers a real merchant API refund and must never be used without authorized account access.

Account: **Security** includes password change, verified new-email requests and individual refresh-session revocation. Google-only accounts without a usable password require secure recovery before email change.

Intelligence: **My account → Intelligence** uses stored market observations, with optional user-supplied cost estimates; history and route distances are shown only where data/providers actually exist.
