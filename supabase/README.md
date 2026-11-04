# Chama Travels database migrations

These migrations define the database foundation and protected booking
operations for the **new** `chama-travels-production` Supabase project. They
do not connect the website or modify any existing/old Supabase project.

> Apply only after the target project has been independently confirmed as the
> new, empty project. Do not copy credentials into this repository.

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

These files are ordered and intended to run once, in a migration-managed
workflow. They are not designed to be pasted piecemeal into an already
populated production schema. Do not use `IF NOT EXISTS` as a way to conceal
partial or out-of-order application.

Migrations 0009 and 0010 are application implementation drafts and have not
been applied to any Supabase project. Review and test them in an isolated
database before scheduling production application.

## Required Supabase settings and access assumptions

- Keep the `private` schema out of the exposed API schemas. The `public` schema
  may remain exposed, but table access is governed by explicit grants and RLS.
- Keep the project’s normal `anon`, `authenticated`, `service_role`, and
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
- `accept_customer_quote` and `accept_guest_quote` enforce ownership/token,
  expiry, quote state, booking state, one-time consumption, transaction locks,
  quote supersession, and confirmation. Database triggers append booking
  events for booking, quote, assignment, and payment-claim/payment changes in
  the same transaction.
- Quote expiry is processed by `public.expire_booking_quotes()`, executable
  only by `service_role`. Configure a trusted scheduler or server worker to
  call it periodically. Expired quotes are audited; a booking returns to
  `reviewing` only when it has no other sent quote.
- Driver settlements are created only for completed assignments, limited to
  the accepted quote currency and total, and paid once by an active Admin or
  Super Admin. Driver reads are limited to their own settlement history.
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
- `QUOTE_EXPIRY_CRON_SECRET` (server only; configure the same value in the
  trusted scheduler that invokes the quote-expiry endpoint)

Set values locally only after verifying the Supabase project reference against
the new `chama-travels-production` project. A project name alone is not enough
to verify its URL/reference. Do not copy old-project credentials.

Automatic WhatsApp delivery is not configured. Existing `wa.me` links remain
manual chat entry points; automated notifications require an approved provider,
business-number configuration, credentials, and any required message templates.
Do not treat a generated acceptance link or notification record as a delivered
WhatsApp message.

Migration 0009 implements the protected operational RPCs; migration 0010
implements driver settlements. They are still subject to isolated PostgreSQL,
RLS, authorization, concurrency, and end-to-end testing before application.
No database connection or migration execution is part of this repository work.

The `customer_user_id` column is nullable for guests and is never populated by
later registration. No guest booking-reference lookup is provided. No
`customer_accepted` booking status exists.

## Static verification after application (not performed by this change)

After applying in an isolated test project, verify:

- All ten migrations are recorded as applied in the expected order.
- Tables exist: `roles`, `profiles`, `user_roles`, `vehicle_categories`,
  `vehicles`, `pricing_packages`, `pricing_rules`, `bookings`, `booking_legs`,
  `booking_events`, `booking_assignments`, `booking_quotes`,
  `booking_quote_lines`, `payment_claims`, `payments`.
- `driver_settlements` exists with its unique assignment relationship and
  completed-assignment/accepted-quote consistency checks.
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
- The bootstrap function is executable only as `postgres` and refuses a
  second active Super Admin.
- Default privileges for future tables, sequences, and functions remain
  restrictive.

Use database integration/security tests for these checks. Reading migration
files or inspecting table names alone does not establish that the database is
secure or that every policy behaves as intended.
