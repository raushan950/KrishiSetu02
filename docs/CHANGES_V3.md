# Changes — integrated trade-resolution build (19 November 2026)

Major differences from the supplied development baseline:

- PostgreSQL migration 0003: buyer-accepted quantities, cancellations, returns, fulfillment receipts, counterparty change requests, disputes, refund requests and manual settlement acknowledgements.
- Migration 0004: secure single-use email change verification with hashed challenge, delivery to new inbox, old-mailbox notice and refresh-token revocation.
- Retired legacy one-sided order cancellation in favor of counterparty-approved adjustment requests.
- Added listing edit/close with stock-reservation guard and audited offer rejection, withdrawal and timed expiry command.
- Added buyer-confirmed partial receipt. Consumed inventory is reduced atomically; the return flow does not automatically restock questionable goods.
- Added two-party request/response for unaccepted quantity cancellation and accepted-produce returns. No refund is inferred from a return.
- Added dispute locking, role-gated administrator decisions, vehicle identity review approval, permissioned pending work queue and order freezing.
- Added gateway-backed refund initiation with administrator decision, one-submission guard, signed provider `refund.processed`/`refund.failed` reconciliation and double-refund checks.
- Added manual settlement acknowledgement, source-level market history, optional ORS route calculation, source-grounded assistant and optional nonauthoritative LLM narration.
- Added institutional aggregate CSV export, refresh-session enumeration/revocation and improved webhook safety.
- Added React interfaces for trade cases, admin decisions, alerts, source history, road routes, email change and active sessions.
- Expanded developer tests for partial receipt, returns, disputes, stock accounting, refunds, acknowledgement and CSV permissions. Test code was written but full Django execution is **not** verified here.

Known incomplete live capabilities and exact test limits are in READINESS.md. Do not label this a production-ready or government-approved release.
