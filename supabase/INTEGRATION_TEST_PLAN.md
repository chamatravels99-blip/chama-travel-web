# Database integration test plan (disposable DB only)

Status: **no PostgreSQL/Docker/Supabase CLI was available when written; nothing below has run against a real database.**

## Environment
1. `supabase start` (Docker) then `supabase db reset` is preferred. Or run a local Postgres 15 with Supabase roles (`anon`, `authenticated`, `service_role`), schemas `auth`, `extensions` (pgcrypto), `storage`, plus `auth.uid()` reading `request.jwt.claim.sub`.
2. `TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres ALLOW_DISPOSABLE_DB=yes node scripts/db-integration.mjs`
   (refuses non-local hosts; applies all migrations then `tests/sql/*.sql`).

## Prioritized tests
| P | Test | Status |
|---|------|--------|
| P0 | Apply all migrations in order on empty DB (syntax, plpgsql OUT-param ambiguity, FKs) | script ready, not run |
| P0 | Catalog: RLS on, no client grants, SECURITY DEFINER has `search_path=''` (`catalog_security.sql`) | written, not run |
| P0 | Client roles lack guest/rate-limit RPC + private table privileges, bucket private (`behavior_no_fixture.sql`) | written, not run |
| P0 | Guest driver token: expiry, revocation, rotation, consumed-after-link, wrong-driver claim | TODO (needs fixtures) |
| P0 | Concurrent accept/decline of one invitation (2 psql sessions, `pg_sleep` in a lock) | TODO |
| P0 | Concurrent `admin_issue_invoice` with same/different request_id: exactly one issued invoice, unique number | TODO |
| P0 | Concurrent `admin_issue_payment_receipt_document`: exactly one document per payment | TODO |
| P0 | Cross-booking: guest customer/driver token cannot authorize another booking's document; IDOR on document id | TODO |
| P1 | Roles x tables RLS matrix: admin, customer, registered driver, guest customer, guest driver | TODO |
| P1 | Customer sees driver details only after assignment `accepted` | TODO |
| P1 | Invoice immutability (update/delete/truncate rejected), replacement creates revision, cancelled invoice not downloadable | TODO |
| P1 | LKR/USD: invoice/payment/offer currency FKs reject mixed currency; balances separate | TODO |
| P1 | Partial payments + partial payouts never exceed totals under concurrency | TODO |
| P1 | Rate limit under concurrency (N parallel `check_rate_limit` -> exactly `limit` allowed) | TODO |
| P2 | Storage: anon/authenticated cannot read/write `booking-documents` objects | TODO (needs storage service) |
| P2 | Guest -> registered linking transitions access to driver dashboard | TODO |

Fixture helper needed: insert `auth.users` + `profiles` + `user_roles` rows, a booking, accepted quote with lines, assignment and offer, then `set local role authenticated; select set_config('request.jwt.claim.sub', '<uuid>', true);` to act as a user.
