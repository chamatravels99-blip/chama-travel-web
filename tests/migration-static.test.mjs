import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const files = [
  '202611140001_guest_driver_invitations.sql',
  '202611140002_booking_documents.sql',
  '202611140003_invoices_and_receipts.sql',
  '202611140004_guest_rate_limiting.sql',
  '202611140005_booking_payment_summary.sql',
  '202611140006_guest_access_security.sql',
  '202611140007_guest_claim_expiry.sql',
  '202611140008_service_booking_submission.sql',
  '202611140009_customer_quote_expiry.sql',
  '202611140010_driver_invitation_expiry.sql',
  '202611140011_finite_booking_leg_times.sql',
  '202611140012_secure_booking_submission.sql',
  '202611140013_booking_rpc_cutover.sql',
  '202611140014_admin_billing_documents_hub.sql',
  '202611140015_application_roles_cutover.sql',
  '202611140016_admin_operations_lifecycle.sql',
  '202611140017_record_booking_payment_receipt.sql',
  '202611140018_internal_driver_fleet_management.sql',
];
const sql = Object.fromEntries(files.map((f) => [f, readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8')]));
const all = Object.values(sql).join('\n');

// Static checks only: these do NOT replace the PostgreSQL integration tests in tests/sql.
test('every new table has RLS enabled and client privileges revoked', () => {
  const tables = [...all.matchAll(/create table (?:if not exists )?((?:public|private)\.[a-z_]+)/g)].map((m) => m[1]);
  assert.ok(tables.length >= 4);
  for (const table of tables) {
    assert.ok(all.includes(`alter table ${table} enable row level security`), `${table} must enable RLS`);
    assert.match(all, new RegExp(`revoke all on (?:table )?${table.replace('.', '\\.')}\\s[^;]*anon`), `${table} must revoke client access`);
  }
});

test('every function sets an empty search_path', () => {
  for (const [file, text] of Object.entries(sql)) {
    const functions = text.split(/create or replace function /).slice(1);
    for (const body of functions) {
      const header = body.slice(0, body.indexOf('as $'));
      assert.match(header, /set search_path = ''/, `${file}: ${header.split('(')[0]} lacks search_path`);
    }
  }
});

test('security definer functions are revoked from public and explicitly granted', () => {
  const grants = all + readFileSync(new URL('../supabase/migrations/202611040007_quotes.sql', import.meta.url), 'utf8');
  const names = [...all.matchAll(/create or replace function (public\.[a-z_]+)\(/g)].map((m) => m[1]);
  for (const name of names) {
    assert.ok(new RegExp(`revoke all on function[^;]*${name.replace('.', '\\.')}\\(`).test(grants), `${name} must be revoked`);
    assert.ok(new RegExp(`grant execute on function[^;]*${name.replace('.', '\\.')}\\(`).test(grants), `${name} must be granted`);
  }
});

test('guest RPCs are service_role only and never granted to anon or authenticated', () => {
  const guest = [...all.matchAll(/grant execute on function([^;]*)to ([a-z_, ]+);/g)];
  for (const [, fns, roles] of guest) {
    for (const fn of fns.split(',').map((s) => s.trim())) {
      if (/\.(guest_|get_guest_driver|check_rate_limit|accept_guest_quote|get_guest_booking_tracker)/.test(fn)) {
        assert.equal(roles.trim(), 'service_role', `${fn} must be service_role only`);
      }
    }
  }
});

test('tokens are stored only as hashes', () => {
  assert.match(sql[files[0]], /token_hash bytea/);
  assert.doesNotMatch(sql[files[0]], /\btoken text not null/);
  assert.match(sql[files[0]], /digest\(/);
  assert.match(sql[files[3]], /bucket_hash bytea/);
});

test('invoices and documents are immutable and non-deletable', () => {
  assert.match(sql[files[2]], /before update or delete on public\.invoices|guard_invoice/);
  assert.match(sql[files[1]], /guard_booking_document/);
  assert.match(sql[files[2]], /unique \(issued_by, request_id\)|unique\(issued_by, request_id\)/);
  assert.match(sql[files[2]], /invoice_number_seq/);
});

test('booking payment summary is authorized, scoped, uncapped, and currency-aware', () => {
  const migration = sql[files[4]];
  const paymentHistory = migration.match(/'payments', coalesce\(\(([\s\S]*?)\), '\[\]'::jsonb\),\s*'quote_summaries'/i)?.[1] ?? '';
  assert.match(migration, /admin_get_booking_payment_summary\(p_booking_id uuid\)\s+returns jsonb/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /private\.has_active_role\([\s\S]*array\['admin', 'super_admin'\]/i);
  assert.match(paymentHistory, /where p\.booking_id = b\.id/);
  assert.doesNotMatch(paymentHistory, /\blimit\b/i);
  assert.match(migration, /where p\.booking_id = b\.id\s+group by p\.currency/i);
  assert.match(migration, /sum\(p\.amount\) filter \(where p\.entry_type = 'receipt'\)/i);
  assert.match(migration, /sum\(p\.amount\) filter \(where p\.entry_type = 'refund'\)/i);
  assert.match(migration, /'outstanding_balance', case[\s\S]*greatest\(summary\.quote_total - summary\.net_paid, 0\)/i);
  assert.match(migration, /'payment_status', case[\s\S]*'refunded'[\s\S]*'unpaid'[\s\S]*'paid'[\s\S]*'partially_paid'/i);
  assert.match(migration, /revoke all on function public\.admin_get_booking_payment_summary\(uuid\)\s+from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.admin_get_booking_payment_summary\(uuid\)\s+to authenticated/i);
});

test('billing document hub is Admin-only, searchable, and paginated', () => {
  const migration = sql[files[13]];
  assert.match(migration, /admin_list_billing_documents\([\s\S]*p_search text[\s\S]*p_document_type text[\s\S]*p_limit integer[\s\S]*p_offset integer/i);
  assert.match(migration, /private\.has_active_role\([\s\S]*array\['admin', 'super_admin'\]/i);
  assert.match(migration, /from public\.invoices as i[\s\S]*from public\.payments as p[\s\S]*p\.entry_type = 'receipt'[\s\S]*p\.receipt_number is not null/i);
  assert.match(migration, /p_limit not between 1 and 101[\s\S]*p_offset not between 0 and 10000/i);
  assert.match(migration, /strpos\(pg_catalog\.lower\(r\.record_number\), pg_catalog\.lower\(v_search\)\)/i);
  assert.match(migration, /revoke all on function public\.admin_list_billing_documents\(text, text, integer, integer\)\s+from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.admin_list_billing_documents\(text, text, integer, integer\)\s+to authenticated/i);
});

test('application role cutover revokes customer/operator access but preserves driver business markers', () => {
  const migration = sql[files[14]];
  assert.match(migration, /r\.code in \('operator', 'customer'\)[\s\S]*ur\.revoked_at is null/i);
  assert.doesNotMatch(migration, /r\.code in \([^)]*'driver'/i);
  assert.match(migration, /v_requested_staff_role is distinct from 'admin'/i);
  assert.match(migration, /Only an active Super Admin is required|An active Super Admin is required/i);
  assert.match(migration, /comment on table public\.user_roles[\s\S]*driver assignments remain an internal dispatch eligibility marker/i);
  assert.match(migration, /insert into public\.profiles[\s\S]*return new;[\s\S]*end;\s*\$function\$/i);
  assert.doesNotMatch(migration, /insert into public\.user_roles \(user_id, role_id\)\s*select new\.id/i);
});

test('financial documents remain customer-scoped and unavailable to drivers', () => {
  const documents = sql[files[1]];
  assert.match(documents, /v_doc\.document_type = 'booking_document'[\s\S]*private\.has_active_role\(p_user_id, array\['driver'\]\)/i);
  assert.match(documents, /d\.booking_id = v_booking_id[\s\S]*d\.customer_visible/i);
  assert.match(documents, /i\.id = d\.source_invoice_id and i\.invoice_status = 'issued'/i);
  assert.match(documents, /p_token text, p_document_id uuid/);
});

test('private storage bucket is non-public', () => {
  assert.match(sql[files[1]], /'booking-documents'/);
  assert.match(sql[files[1]], /false/);
  assert.doesNotMatch(sql[files[1]], /public\s*=\s*true/i);
});

test('guest access security preserves revocations and restricts privileged entry points', () => {
  const migration = sql[files[5]];
  assert.match(migration, /where e\.booking_id = p_booking_id\s+and e\.event_type = 'guest_booking_tracker_link_revoked'/);
  assert.match(migration, /for update;[\s\S]*guest_booking_tracker_link_revoked/);
  assert.match(migration, /lock_valid_driver_invitation[\s\S]*not private\.has_active_role\(v_invitation\.driver_user_id, array\['driver'\]\)/);
  assert.match(migration, /resolve_driver_invitation[\s\S]*private\.has_active_role\(i\.driver_user_id, array\['driver'\]\)/);
  assert.match(migration, /service_claim_guest_booking_access[\s\S]*private\.has_active_role\(p_user_id, array\['customer'\]\)/);
  assert.match(migration, /service_claim_driver_invitation[\s\S]*v_invitation\.driver_user_id is distinct from p_user_id/);
  assert.match(migration, /revoke all on function public\.issue_guest_booking_tracker_token\(uuid, text\),[\s\S]*public\.claim_guest_booking_access\(text\),[\s\S]*public\.claim_driver_invitation\(text\),[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.issue_guest_booking_tracker_token\(uuid, text\),[\s\S]*public\.service_claim_driver_invitation\(text, uuid\)\s+to service_role/);
});

test('guest issuance routes enforce limits and account-link claims are disabled', () => {
  const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const booking = read('app/api/bookings/route.ts');
  const tracker = read('app/api/guest/bookings/access/route.ts');
  const driver = read('app/api/guest/driver-invitations/route.ts');
  const limiter = read('lib/server/rate-limit.ts');
  assert.match(limiter, /guest_tracker_issue: \{ tokenLimit: 10, ipLimit: 40, windowSeconds: 300 \}/);
  assert.ok(booking.indexOf("enforceGuestRateLimit(request, 'guest_tracker_issue'") < booking.indexOf("supabase.rpc('create_booking'"));
  assert.match(booking, /serviceClient\.rpc\(\s*'issue_guest_booking_tracker_token'/);
  assert.ok(tracker.indexOf("enforceGuestRateLimit(request, 'guest_tracker'") < tracker.indexOf("rpc('get_guest_booking_tracker'"));
  assert.doesNotMatch(tracker, /service_claim_guest_booking_access|requireRoles/);
  assert.ok(driver.indexOf("enforceGuestRateLimit(request, 'guest_driver_invitation'") < driver.indexOf("rpc('get_guest_driver_invitation'"));
  assert.doesNotMatch(driver, /service_claim_driver_invitation|action === 'link'|requireRoles/);
});

test('guest claim checks expiry after locking the booking and token', () => {
  const migration = sql[files[6]];
  assert.match(migration, /from public\.bookings as b[\s\S]*for update;[\s\S]*select t\.expires_at into v_expires_at[\s\S]*for update;[\s\S]*v_now := pg_catalog\.clock_timestamp\(\);[\s\S]*if v_expires_at <= v_now/);
  assert.match(migration, /revoke all on function public\.service_claim_guest_booking_access\(text, uuid\)\s+from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.service_claim_guest_booking_access\(text, uuid\)\s+to service_role/);
});

test('staged booking RPC is service-only and preserves the verified actor', () => {
  const migration = sql[files[7]];
  const route = readFileSync(new URL('../app/api/bookings/route.ts', import.meta.url), 'utf8');
  assert.match(migration, /private\.has_active_role\(p_customer_user_id, array\['customer'\]\)/);
  assert.match(migration, /request\.jwt\.claim\.sub[\s\S]*p_customer_user_id::text/);
  assert.match(migration, /from public\.create_booking\(/);
  assert.match(migration, /request\.jwt\.claim\.sub', coalesce\(v_old_sub, ''\)/);
  assert.match(migration, /revoke all on function public\.service_create_booking\([\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.service_create_booking\([\s\S]*to service_role/);
  assert.doesNotMatch(migration, /revoke all on function public\.create_booking\(/);
  assert.match(route, /BOOKING_SERVER_RPC_ENABLED === 'true'/);
  assert.ok(route.indexOf("enforceGuestRateLimit(request, 'booking_submit'") < route.indexOf("'issue_booking_submission_token'"));
  assert.match(route, /p_customer_user_id: user\?\.id \?\? null/);
});

test('protected booking path binds a single-use token to the authenticated actor and payload', () => {
  const migration = sql[files[11]];
  const cutover = sql[files[12]];
  const route = readFileSync(new URL('../app/api/bookings/route.ts', import.meta.url), 'utf8');
  assert.match(migration, /grant execute on function public\.issue_booking_submission_token\(uuid, jsonb\) to service_role/);
  assert.match(migration, /for update;[\s\S]*v_token\.expires_at <= pg_catalog\.clock_timestamp\(\)/);
  assert.match(migration, /v_token\.customer_user_id is distinct from \(select auth\.uid\(\)\)/);
  assert.match(migration, /v_token\.payload_hash is distinct from extensions\.digest/);
  assert.match(migration, /delete from private\.booking_submission_tokens[\s\S]*from public\.create_booking/);
  assert.match(migration, /drop function if exists public\.service_create_booking\(/);
  assert.match(migration, /p_requested_currency text/);
  assert.match(migration, /p_requested_currency not in \('LKR', 'USD'\)/);
  assert.match(migration, /p_requested_currency::char\(3\)/);
  assert.doesNotMatch(migration, /set_config\(\s*'request\.jwt/);
  assert.match(cutover, /Booking cutover prerequisites are missing/);
  assert.match(cutover, /Another public booking overload remains executable/);
  assert.match(cutover, /revoke all on function public\.create_booking\([\s\S]*from public, anon, authenticated, service_role/);
  assert.ok(route.indexOf("enforceGuestRateLimit(request, 'booking_submit'") < route.indexOf("'issue_booking_submission_token'"));
  assert.match(route, /supabase\.rpc\('service_create_booking'/);
});

test('registered customer quote acceptance checks expiry after locking', () => {
  const migration = sql[files[8]];
  const previous = readFileSync(new URL('../supabase/migrations/202611130005_guest_booking_tracker.sql', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n')
    .match(/create or replace function public\.accept_customer_quote\([\s\S]*?\$function\$;/)?.[0];
  assert.ok(previous);
  const expected = previous
    .replace('v_now timestamptz := pg_catalog.clock_timestamp();', 'v_now timestamptz;')
    .replace('   for update;\n  if not found', '   for update;\n  v_now := pg_catalog.clock_timestamp();\n  if not found');
  assert.equal(migration.slice(migration.indexOf('create or replace function')).replace(/\r\n/g, '\n').trim(), expected);
  assert.match(migration, /for update of b, p;[\s\S]*from public\.booking_quotes as q[\s\S]*for update;\s*v_now := pg_catalog\.clock_timestamp\(\);\s*if not found[\s\S]*v_expires_at <= v_now/);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /v_customer_user_id is distinct from v_user_id/);
  assert.match(migration, /v_quote_status <> 'sent'/);
});

test('guest driver responses recheck invitation expiry after their row locks', () => {
  const migration = sql[files[9]].replace(/\r\n/g, '\n');
  const original = sql[files[0]].replace(/\r\n/g, '\n');
  for (const [name, oldCheck, newCheck] of [
    [
      'guest_driver_respond_assignment',
      '   for update;\n  if not found\n     or v_assignment.assignment_status',
      '   for update;\n  v_now := pg_catalog.clock_timestamp();\n  if not found\n     or v_invitation.expires_at <= v_now\n     or v_assignment.assignment_status',
    ],
    [
      'guest_driver_respond_hire_offer',
      "   for update of o;\n  if not found or v_offer.offer_status <> 'offered' then",
      "   for update of o;\n  v_now := pg_catalog.clock_timestamp();\n  if not found\n     or v_invitation.expires_at <= v_now\n     or v_offer.offer_status <> 'offered'\n  then",
    ],
  ]) {
    const pattern = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`);
    const previous = original.match(pattern)?.[0];
    const replacement = migration.match(pattern)?.[0];
    assert.ok(previous && replacement);
    assert.ok(previous.includes(oldCheck));
    assert.equal(
      replacement,
      previous
        .replace('v_now timestamptz := pg_catalog.clock_timestamp();', 'v_now timestamptz;')
        .replace(oldCheck, newCheck)
    );
  }
  assert.match(migration, /guest_driver_respond_assignment[\s\S]*from public\.bookings as b[\s\S]*for update;\s*v_now := pg_catalog\.clock_timestamp\(\);\s*if not found\s+or v_invitation\.expires_at <= v_now/);
  assert.match(migration, /guest_driver_respond_hire_offer[\s\S]*for update of o;\s*v_now := pg_catalog\.clock_timestamp\(\);\s*if not found\s+or v_invitation\.expires_at <= v_now/);
});

test('booking leg finite-time constraint protects new writes without validating old rows', () => {
  const migration = sql[files[10]];
  for (const column of ['pickup_at', 'planned_end_at', 'flight_arrival_at']) {
    assert.match(migration, new RegExp(`pg_catalog\\.isfinite\\(${column}\\)`));
  }
  assert.match(migration, /\)\s+not valid;/i);
});
