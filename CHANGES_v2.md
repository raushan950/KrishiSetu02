# Release notes: KrishiSetu expanded development source

Compared with the initial development ZIP, this revision adds:

- Fixed verification-code failure counters to persist after invalid attempts; challenge resend operations lock the account.
- Added scoped login/password-reset throttling, password-change endpoint and refresh-token revocation on password resets/changes.
- Added a configured Google Identity Services button for sign-in and account linking (subject to provider verification).
- Added crop catalogue seed command that seeds **no prices or transactions**.
- Added price-alert subscriptions, deduplicated in-app evaluation command and optional opt-in import scheduler.
- Added chronological median price baseline with data coverage, freshness and error disclosures; not a calibrated ML forecast.
- Added Razorpay gateway order creation, signed callbacks, authenticated webhook verification and deduplicated captured-payment audit records; added safeguards against combining gateway payment with manual settlement/cancellation.
- Added farmer farm management, photo upload, counteroffer responses, payment, freight, and settlement pages.
- Enhanced compare page to rank mandi observations and eligible direct offers using explicitly supplied transport costs, other deductions and loss percentages.
- Tightened Docker password configuration, static assets collection, docs, new migration and tests.

## Evidence and delivery limits

Executable checks performed: 13 standard-library assertion checks for calculation/forecast/signature helpers; Python `compileall` passed; four JS/JSX files parsed with TypeScript; archive generated and checked for corruption.

Unverified here: Django checks/ORM/migrations/pytest, Node dependency installation/Vite production bundle, PostgreSQL under concurrency, provider sandbox transactions, browser accessibility and deployment. They require a machine with internet, packages and external provider accounts.

This is a DEVELOPMENT release. **Do not use for public trading with real money until all security, financial, legal and operational gates are satisfied.**
