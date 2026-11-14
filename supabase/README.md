# Chama Travels database migrations

These migrations define the database foundation and protected booking
operations. Local migration files alone do not establish which changes are
present in the existing production project.

> Independently verify the target project, migration ledger and live schema
> before planning any application. Do not copy credentials into this repository.

## Migration order

Apply the files in lexicographic order using the Supabase CLI or the Supabase
Dashboard migration workflow:

1. `migrations/202611040001_foundation.sql`
   - Installs `btree_gist` and `pgcrypto` in the Supabase `extensions` schema.
   - Creates the non-API `private` schema, restrictive defaults, and the
     `updated_at` trigger helper.
2. `migrations/202611040002_identity_and_roles.sql`
   - Creates role catalogue, profiles, role assignments, private privileged
     audit storage, Auth profile/customer-role trigger, and the one-time
     Super Admin bootstrap function.
3. `migrations/202611040003_vehicles.sql`
   - Creates configurable vehicle categories and fleet vehicle records.
4. `migrations/202611040004_pricing.sql`
   - Creates pricing packages and declarative pricing rules for LKR/USD.
5. `migrations/202611040005_bookings_and_events.sql`
   - Creates bookings, ordered trip legs, append-only booking events, and
     customer row-access helpers/policies. New records default to `pending`;
     invalid booking lifecycle transitions are rejected.
6. `migrations/202611040006_booking_assignments.sql`
   - Creates booking assignments, one-active-assignment-per-booking
     protection, deferred booking/assignment consistency, and GiST
     driver/vehicle overlap exclusion constraints.
7. `migrations/202611040007_quotes.sql`
   - Creates quote revisions/lines, deferred quote-total and booking/quote
     consistency checks, quote-line currency/arithmetic validation, immutable
     issued terms, authenticated and guest acceptance operations, and
     quote-expiry processing.
   - Successful quote acceptance confirms the booking in the same transaction.
     No `customer_accepted` booking status is defined.
8. `migrations/202611040008_payments.sql`
   - Creates payment claims and the immutable verified receipt/refund ledger,
     with accepted-quote, currency, role, and refund-balance validation.
9. `migrations/202611040009_booking_operations.sql`
   - Adds requested booking currency and refund reasons, seeds standard vehicle
     categories, and creates narrowly granted functions for booking creation,
     pricing-based quote issuance, dispatch, driver status updates, customer
     payment claims, Admin payment verification/refunds, and fleet/pricing
     administration.
   - The refund-reason check is added `NOT VALID` so any pre-existing immutable
     refund entries without a reason are preserved; new ledger entries must
     satisfy the check.
10. `migrations/202611040010_driver_settlements.sql`
    - Adds Admin-managed driver settlements for completed assignments, records
      payout status once, appends booking events, and provides driver/admin
      settlement reads.
11. `migrations/202611070001_admin_user_management.sql`
    - Adds protected Admin user listing and account management operations.
12. `migrations/202611070002_atomic_staff_provisioning.sql`
    - Adds trusted metadata handling for atomic staff account provisioning.
13. `migrations/202611080001_optional_booking_end_time.sql`
    - Updates `create_booking` to allow a trip leg without a planned end time,
      while retaining pickup-time, leg-order, authorization, idempotency, and
      booking-reference checks.
14. `migrations/202611100001_deferred_booking_triggers_security_definer.sql`
    - Runs the booking-leg, assignment and quote-state deferred checks with
      their owner's privileges.
15. `migrations/202611110001_booking_management_workflow.sql`
    - Adds booking review, manual end-time and quotation operations, customer
      quote rejection and accepted-driver details, and an on-the-way event.
    - Requires all legs to have finite pickup and expected end times before
      issuing either kind of quote. End times can only be edited while a
      booking is pending or under review.
16. `migrations/202611120001_driver_progress_read.sql`
    - Exposes on-the-way markers only for assignments belonging to the
      authenticated active driver. The driver dashboard requires this function.
17. `migrations/202611130001_manual_whatsapp_quote_confirmation.sql`
    - Records quote confirmation method and adds an Admin-only manual WhatsApp
      acceptance operation that confirms the booking and appends an event.
18. `migrations/202611130002_guest_quote_link_revocation.sql`
    - Adds a one-way guest-token revocation timestamp, rejects revoked tokens
      during guest quote acceptance, and adds an audited Admin revocation RPC.
19. `migrations/202611130003_admin_booking_activity.sql`
    - Adds append-only private Admin notes and an Admin-only booking activity
      read that does not expose note content through customer-facing events.
20. `migrations/202611130004_admin_customer_payment_receipts.sql`
    - Adds immutable receipt numbering and payment dates, Admin-recorded
      partial payments against accepted quotes, and a currency-specific
      outstanding-payment candidate list.
21. `migrations/202611130005_guest_booking_tracker.sql`
    - Adds a private hash-only guest tracker capability, minimized token-based
      booking reads, secure customer-account claiming with the link as proof of
      ownership, and Admin revocation/status RPCs.
22. `migrations/202611130006_driver_hire_offers_and_partial_payouts.sql`
    - Adds immutable driver hire offer revisions, driver acceptance/decline,
      Admin-only partial payouts with request idempotency, accepted-currency
      balance checks, driver-scoped reads, and append-only booking events.
    - Preserves the legacy one-time settlement ledger and prevents new hire
      offers for assignments with a legacy settlement.
23. `migrations/202611130007_admin_financial_reporting.sql`
    - Adds an Admin-only date-filtered aggregate RPC for customer receipts and
      refunds, accepted customer balances, driver hire obligations, legacy
      and partial driver payouts, currency-specific method breakdowns, and
      monthly/annual summaries.

These files are ordered and intended to run once, in a migration-managed
workflow. They are not designed to be pasted piecemeal into an already
populated production schema. Do not use `IF NOT EXISTS` as a way to conceal
partial or out-of-order application.

Database deployment status must be verified independently for each target.
Review and test unapplied migrations in an isolated database before scheduling
production application.

## Guest driver invitations, billing documents, private storage, rate limiting

Additional local migration definitions; their production application status
must be verified independently:

24. `migrations/202611140001_guest_driver_invitations.sql` - hash-only,
    expiring, revocable, single-assignment driver invitations; guest
    accept/decline of the assignment and hire offer (service_role RPCs);
    `claim_driver_invitation` links an invitation only for the invited driver
    account. Customer contact details are shown to the driver after
    acceptance only.
25. `migrations/202611140002_booking_documents.sql` - `booking_documents`
    metadata (immutable, no delete), authorization RPCs for admin, owning
    customer, accepted assigned driver and token guests, admin guest-access
    revocation, and the private `booking-documents` Storage bucket.
26. `migrations/202611140003_invoices_and_receipts.sql` - immutable `invoices`
    with issue-time snapshots, sequence numbering (`CT-INV-YYYY-nnnnnn`, gaps
    possible after rollback), replace/cancel instead of edit, idempotent
    receipt documents tied to recorded payments.
27. `migrations/202611140004_guest_rate_limiting.sql` - persistent hashed
    fixed-window counters (`check_rate_limit`); guest tracker and quote
    acceptance RPCs become service_role only.
28. `migrations/202611140005_booking_payment_summary.sql` - adds the
    authenticated-Admin-only `admin_get_booking_payment_summary(uuid)` RPC for
    a booking-scoped, complete payment/refund ledger and per-quote totals.
29. `migrations/202611140006_guest_access_security.sql` - prevents tracker
    reissuance after an explicit Admin revocation, rejects invitations for
    inactive drivers, and restricts issuance and account linking to the
    rate-limited server routes.
30. `migrations/202611140007_guest_claim_expiry.sql` - checks tracker-token
    expiry after the booking and token locks are acquired.
31. `migrations/202611140008_service_booking_submission.sql` - adds a staged
    service-only booking RPC while preserving the existing booking grants.
32. `migrations/202611140009_customer_quote_expiry.sql` - checks registered
    customer quote expiry after locking the booking, customer profile and quote.
33. `migrations/202611140010_driver_invitation_expiry.sql` - rechecks guest
    driver invitation expiry after locking the assignment, booking or offer.
34. `migrations/202611140011_finite_booking_leg_times.sql` - rejects non-finite
    booking leg timestamps on new writes without validating existing rows.
    Audit existing rows first: updates to a non-finite legacy row will fail
    until its schedule is corrected.
35. `migrations/202611140012_secure_booking_submission.sql` - stages a
    single-use booking authorization bound to the exact payload and the
    Supabase-verified request identity. Removes the earlier unsafe wrapper.
36. `migrations/202611140013_booking_rpc_cutover.sql` - revokes direct access
    to the old booking RPC. Apply only after the staged path is verified and
    the updated application is deployed with the protected path enabled.

The application changes and migration 29 must be released together: the
migration revokes the old public claim RPCs and the updated routes require its
service-only replacements. Until both are in place, guest issuance or linking
can fail. Test the coordinated release in an isolated environment first; do
not apply this migration to production without a separate deployment approval.
After revocation, the original booking key can no longer issue a tracking link;
customers must contact Chama Travels for assistance.

The old `create_booking` RPC remains directly callable until migration 36;
enabling the route alone does not close that bypass. Migration 35 replaces the
unsafe staged wrapper: the service client issues a short-lived, single-use
authorization after route validation and rate limiting, while the actual
booking call uses the customer's Supabase session (or the anonymous session).
The database compares its verified `auth.uid()` and the exact booking payload
against the authorization; the supplied ID alone cannot create a booking.
The token is never returned to the browser. The legacy booking function still
provides validation, idempotency, ownership and audit behavior.
The protected wrapper accepts currency as text, rejects anything other than
`LKR` or `USD`, and only then converts the valid three-character value for the
legacy function. Test both currencies through the actual Supabase API; SQL
function signatures alone do not prove the live RPC conversion behavior.
Both feature-flag settings require migration 27's rate-limit RPC and server
configuration for booking submissions. Deploying the updated application
before those prerequisites exist will cause submissions to fail closed.

First verify the production migration ledger and schema; do not assume any
local migration is pending or applied. Migration 35 was corrected locally;
if its version is already recorded as applied, do not rerun it or assume the
corrected definition is live. Reconcile the live objects and prepare a reviewed
forward migration instead. Test migrations 35 and 36 and both
booking flows on a disposable database, including JWT authentication,
ownership, claims, retries, audit events and denied direct calls. Do not apply
36 or enable this path in production until those tests pass. For a coordinated
release, apply 35 with the old feature flag off, deploy the updated application,
enable `BOOKING_SERVER_RPC_ENABLED=true`, verify both flows, then apply 36.
Migration 35 removes the earlier wrapper if present, so old application code
with the flag enabled is incompatible. Migration 36 checks database
prerequisites, but cannot verify that the application is deployed or that
end-to-end testing passed. Before 36, rollback can disable the flag; after
36, restoring old code also requires restoring the former grants, which
reopens the direct-RPC bypass. Never restore grants without explicit approval.

IP rate limits use a shared `unknown` bucket by default; this can throttle
unrelated visitors together. Only set `TRUST_CLOUDFLARE_CLIENT_IP=true` after
verifying that all requests reach the application through Cloudflare and that
the origin cannot be accessed directly. The rate limiter then uses only
`CF-Connecting-IP`, never `X-Real-IP` or `X-Forwarded-For`. These deployment
properties cannot be established from this repository.

Required server configuration (Cloudflare secrets, not committed):
`SUPABASE_SERVICE_ROLE_KEY` (server only) and `RATE_LIMIT_SECRET` (random
string used to key the rate-limit hashes). Rate limiting fails closed (503)
if the service client is unavailable. Optional Cloudflare WAF rate rules in
front of `/api/guest/*` cannot be configured locally and are recommended as
an extra layer. Storage objects are reachable only through authorized API
routes; the bucket has no client policies.

Testing:

- `node --test tests/*.test.mjs` runs the local PDF and static migration tests.
- `tests/sql/catalog_security.sql` checks database catalog security.
- `tests/sql/booking_payment_summary_integration.sql` exercises the booking
  payment summary with synthetic users, bookings, quotes, payments, refunds,
  and invoice replacements. It runs in a transaction and rolls back its fixture
  rows; invoice/payment sequence values can still advance.
- `tests/sql/guest_access_security_integration.sql` exercises tracker revocation,
  customer linking and driver invitation access with synthetic fixtures in a
  rollback-only transaction. It must not be run against production.
- `tests/guest-claim-expiry-concurrency.mjs` verifies expiry while waiting for
  either the booking or token lock. It commits synthetic fixtures so both
  connections can see them; use only a dedicated disposable test instance.

Run database tests only against a disposable local Supabase/PostgreSQL
instance or a dedicated non-production staging project, after applying all
migrations in order through `202611140011_finite_booking_leg_times.sql`.
Never point a test connection or migration command at production.

For the local Supabase stack, `scripts/db-integration.mjs` applies all local
migrations and runs every `tests/sql/*.sql` file. It requires `psql`, a
disposable local `TEST_DATABASE_URL`, and `ALLOW_DISPOSABLE_DB=yes`; it rejects
non-loopback hosts and connection-string parameters. The runners clear inherited
libpq settings and ignore `psql` startup files. A loopback address does not
prove the database is disposable: independently verify the server, database
and any local port forwards before running anything. In PowerShell, set those
two environment variables to the local test database values and run:

```powershell
node scripts/db-integration.mjs
node tests/guest-claim-expiry-concurrency.mjs booking
node tests/guest-claim-expiry-concurrency.mjs token
```

For staging, first independently verify that the Supabase project reference
belongs to the dedicated test project, then apply the reviewed migrations
there in lexicographic order using the project's migration workflow. Run the
integration file as one transaction in the Supabase SQL Editor, or connect
directly with `psql` using a staging-only connection string:

```powershell
psql $env:STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f tests/sql/booking_payment_summary_integration.sql
```

The test script itself does not apply migrations. It inserts random, temporary
Auth users and related fixture data, tests the RPC as simulated authenticated
Admin/customer roles, and rolls back. Successful execution prints
`booking_payment_summary_integration: all assertions passed`. A rollback still
consumes sequence values, so use a disposable/staging database only. These SQL
tests have not been executed in the current environment; `psql`, Docker, and
the Supabase CLI are unavailable here. Fixture-based RLS, token-expiry,
concurrency, linking, and visibility tests still need to be run in a disposable
Supabase/PostgreSQL project.
## Required Supabase settings and access assumptions

- Keep the `private` schema out of the exposed API schemas. The `public` schema
  may remain exposed, but table access is governed by explicit grants and RLS.
- Keep the projectâ€™s normal `anon`, `authenticated`, `service_role`, and
  `postgres` roles available. The migrations intentionally revoke direct
  application-table access from `anon`, `authenticated`, and `service_role`
  except for the explicitly granted customer reads, safe active category
  catalogue, customer quote-acceptance function, and guest quote-acceptance
  function.
- `service_role` is not granted broad table access by these migrations.
  Additional server operations require a separately reviewed migration with
  narrow function grants; never put the service-role credential in browser code.
- The guest quote token must be generated with a cryptographically secure
  random generator by trusted server code. Store only its SHA-256 hash in
  `booking_quotes.acceptance_token_hash`; never log or return the raw token
  except through its approved delivery channel.
- The guest acceptance RPC accepts only a quote ID and high-entropy token and
  returns no booking details. Do not add a booking-reference lookup endpoint.
  Apply rate limiting at the trusted API boundary.
- Guest tracker capabilities are separate from quote-acceptance tokens. The
  tracker token is 256-bit random, stored only as a SHA-256 hash, placed in the
  URL fragment (not sent in HTTP requests or referrers), expires after one
  year, and can be revoked by an Admin. Its database RPC returns a minimized
  booking DTO; possession of the tracker link plus an authenticated customer
  session is required to claim a guest booking. No public reference/email
  claim lookup exists.
- `accept_customer_quote` and `accept_guest_quote` enforce ownership/token,
  expiry, quote state, booking state, one-time consumption, transaction locks,
  quote supersession, and confirmation. Database triggers append booking
  events for booking, quote, assignment, and payment-claim/payment changes in
  the same transaction.
- `admin_revoke_guest_quote_acceptance_link` can revoke an active guest quote
  link without changing the quote amount/status, booking status or payment
  records. Revocation is one-way, actor-attributed and recorded in
  `booking_events`; `accept_guest_quote` rejects the revoked token.
- Quote expiry is processed by `public.expire_booking_quotes()`, executable
  only by `service_role`. Configure a trusted scheduler or server worker to
  call it periodically. Expired quotes are audited; a booking returns to
  `reviewing` only when it has no other sent quote.
- Driver settlements are created only for completed assignments, limited to
  the accepted quote currency and total, and paid once by an active Admin or
  Super Admin. Driver reads are limited to their own settlement history.
- New driver hire offers use a separate LKR/USD compensation ledger; drivers
  must accept the current revision before Admin can record partial payouts.
  Payout entries are immutable, request-idempotent, assignment-locked against
  overpayment, and distinct from customer receipts/refunds. Legacy assignments
  with an existing one-time settlement remain in that historical workflow.
- Admin financial reports use an authorized database aggregate over complete
  ledgers rather than capped UI lists. Each currency is returned separately;
  transaction activity uses local business dates, while outstanding balances
  use the selected period's accepted/created cohort and payment history through
  the period end.
- Driver/vehicle reservation exclusions use `extensions.gist_uuid_ops` from
  `btree_gist`; keep the extension installed in the `extensions` schema.
- Driver/vehicle reservations use the period from earliest pickup through
  latest planned end. An assignment cannot be inserted until every leg has a
  `planned_end_at`. This conservative rule may block availability between
  multi-day legs.
- Trip timestamps are `timestamptz`. Trusted application code must interpret
  Sri Lankan local input in `Asia/Colombo` before converting it to UTC.

## One-time Super Admin bootstrap

1. Create/invite the intended Auth user through the trusted Supabase Auth
   administration process. Do not assign a role through user metadata.
2. Confirm that the Auth user has an active profile created by the trigger.
3. In a trusted SQL administration session running as `postgres`, call
   `private.bootstrap_first_super_admin(<verified-auth-user-uuid>)` once.
   The function serializes attempts, refuses to run if an active Super Admin
   already exists, and records the bootstrap in the private audit table.
4. Verify the role assignment and audit record using the trusted administration
   session. Do not grant the bootstrap function to browser/API roles and do not
   create a reusable bootstrap endpoint.

No password, API key, service-role key, token, or secret belongs in this
README, migration history, or source control.

## Application configuration and remaining external setup

The website requires these local environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to browser code)
- `RATE_LIMIT_SECRET` (server only; required by the guest rate limiter)
- `BOOKING_SERVER_RPC_ENABLED` (optional server-only staged booking switch;
  do not enable until the replacement flow is verified)
- `TRUST_CLOUDFLARE_CLIENT_IP` (optional server-only switch; enable only after
  verifying Cloudflare-only origin access as described above)
- `QUOTE_EXPIRY_CRON_SECRET` (server only; configure the same value in the
  trusted scheduler that invokes the quote-expiry endpoint)
- `INVOICE_PAYMENT_INSTRUCTIONS` (optional server-only invoice text; if unset,
  invoices direct customers to contact Chama Travels rather than displaying
  unverified bank or payment details)

Set values only after independently verifying the intended Supabase project
reference. A project name alone is not enough to verify its URL/reference.

Automatic WhatsApp delivery is not configured. Existing `wa.me` links remain
manual chat entry points; automated notifications require an approved provider,
business-number configuration, credentials, and any required message templates.
Do not treat a generated acceptance link or notification record as a delivered
WhatsApp message.

Migration 0009 implements the protected operational RPCs; migration 0010
implements legacy driver settlements; migration `202611130006` adds hire offer
revisions and partial payouts without rewriting those rows; migration
`202611130007` adds financial aggregates. These remain subject to isolated
PostgreSQL, RLS, authorization, concurrency, and end-to-end testing before
application. No database connection or migration execution is part of this
repository work.

The `customer_user_id` column is nullable for guests. A guest booking can be
linked through the tracker claim workflow to a verified customer account. No
guest booking-reference lookup is provided. No `customer_accepted` booking
status exists.

## Static verification after application (not performed by this change)

After applying in an isolated test project, verify:

- All migrations are recorded as applied in the expected order.
- Tables exist: `roles`, `profiles`, `user_roles`, `vehicle_categories`,
  `vehicles`, `pricing_packages`, `pricing_rules`, `bookings`, `booking_legs`,
  `booking_events`, `booking_assignments`, `booking_quotes`,
  `booking_quote_lines`, `payment_claims`, `payments`, `driver_hire_offers`,
  and `driver_hire_payouts`.
- `driver_settlements` exists with its unique assignment relationship and
  completed-assignment/accepted-quote consistency checks.
- Driver hire offer acceptance, revision history, duplicate payout requests,
  concurrent partial payouts, currency changes after payout, and balance
  limits behave correctly.
- Date-filtered Admin reports match complete ledger aggregates and never mix
  LKR and USD; monthly/annual totals and payment-method breakdowns reconcile
  to the period activity.
- RLS is enabled on every application table; `private` is not an exposed API
  schema.
- `anon` cannot select bookings, profiles, quotes, assignments, claims, or
  payments; authenticated users are limited to the policies/grants in the
  migrations; `service_role` has no direct table grants.
- A customer can read only owned records; a driver can read only assigned,
  minimized trip fields; anonymous users cannot retrieve bookings by reference.
- A valid authenticated or guest quote acceptance atomically accepts one quote,
  supersedes other sent revisions, sets the booking to `confirmed`, and appends
  events. Replays, expiry, cancellation, rejection, and concurrent acceptance
  are rejected.
- Quote line totals, pricing-rule currency, booking/quote status relationships,
  currency composite foreign keys, quote-line arithmetic, assignment status
  consistency/overlap constraints, payment totals, and refund constraints
  behave as intended.
- Booking transitions outside the allowed lifecycle are rejected, and
  assignments cannot leave a booking assigned/in-progress/completed without
  the matching driver assignment state.
- `booking_events` and `payments` reject update/delete operations.
- Driver settlement creation is Admin-only, one-per-completed-assignment, and
  payout is a one-time audited transition; drivers can read only their own
  records.
- Driver hire offer revisions retain previous terms and response history;
  only the assigned active driver can answer the current offer. Payouts are
  Admin-only, append-only, idempotent, currency-consistent and cannot exceed
  the accepted offer balance, including under concurrent requests.
- The bootstrap function is executable only as `postgres` and refuses a
  second active Super Admin.
- Default privileges for future tables, sequences, and functions remain
  restrictive.

Use database integration/security tests for these checks. Reading migration
files or inspecting table names alone does not establish that the database is
secure or that every policy behaves as intended.
