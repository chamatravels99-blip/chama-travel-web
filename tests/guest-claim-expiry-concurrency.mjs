// Run only on an independently verified disposable local Supabase database.
// The concurrent sessions require committed synthetic fixtures; reset the test
// database afterwards. Never run this script against production.
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { disposableDatabaseEnvironment } from '../scripts/disposable-db.mjs';

const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.ALLOW_DISPOSABLE_DB !== 'yes') {
  throw new Error('Set TEST_DATABASE_URL and ALLOW_DISPOSABLE_DB=yes for a disposable database.');
}
const dbEnv = disposableDatabaseEnvironment(url);

const actor = randomUUID();
const booking = randomUUID();
const token = randomBytes(32).toString('hex');
const lockTarget = process.argv[2] ?? 'booking';
if (lockTarget !== 'booking' && lockTarget !== 'token') {
  throw new Error('Lock target must be booking or token.');
}
const application = `guest-expiry-${randomUUID()}`;
const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'];
const holder = spawn('psql', args, { stdio: ['pipe', 'pipe', 'pipe'], env: dbEnv });
let holderOutput = '';
let holderErrors = '';
let holderExit;
holder.stdout.setEncoding('utf8');
holder.stderr.setEncoding('utf8');
holder.stdout.on('data', (data) => { holderOutput += data; });
holder.stderr.on('data', (data) => { holderErrors += data; });
holder.on('error', (error) => { holderExit = error.message; });
holder.on('exit', (code) => { holderExit = `exit ${code}`; });

async function waitForMarker(marker) {
  const deadline = Date.now() + 30000;
  while (!holderOutput.split(/\r?\n/).includes(marker)) {
    if (holderExit) throw new Error(`Lock session failed (${holderExit}): ${holderErrors}`);
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${marker}: ${holderErrors}`);
    await sleep(50);
  }
}

function query(sql) {
  const result = spawnSync('psql', [...args, '-c', sql], { encoding: 'utf8', env: dbEnv });
  if (result.error || result.status !== 0) {
    throw new Error(`Database test query failed: ${result.error?.message ?? result.stderr}`);
  }
  return result.stdout.trim();
}

let claimant;
try {
  holder.stdin.write(`
begin;
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '${actor}', 'authenticated', 'authenticated', 'expiry-${actor}@example.invalid', '',
  pg_catalog.clock_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Expiry Test"}'::jsonb, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
);
insert into public.bookings (
  id, booking_ref, customer_name, customer_email, customer_phone,
  service_type, journey_type, passenger_count, luggage_count
) values (
  '${booking}', 'TEST-EXPIRY-${booking}', 'Expiry Test', 'expiry@example.invalid',
  '+94710000000', 'airport_transfer', 'one_way', 1, 0
);
insert into public.booking_legs (
  booking_id, sequence_no, pickup_location, dropoff_location, pickup_at, planned_end_at
) values (
  '${booking}', 1, 'Test pickup', 'Test dropoff',
  pg_catalog.now() + interval '30 days', pg_catalog.now() + interval '30 days 2 hours'
);
insert into private.guest_booking_access_tokens (booking_id, token_hash, expires_at)
values (
  '${booking}', extensions.digest(pg_catalog.convert_to('${token}', 'UTF8'), 'sha256'),
  pg_catalog.clock_timestamp() + interval '15 seconds'
);
commit;
begin;
${lockTarget === 'booking'
    ? `select id from public.bookings where id = '${booking}' for update;`
    : `select id from private.guest_booking_access_tokens where booking_id = '${booking}' for update;`}
\\echo holder_locked
`);
  await waitForMarker('holder_locked');

  const claimSql = `
set application_name = '${application}';
set role service_role;
do $test$
begin
  begin
    perform public.service_claim_guest_booking_access('${token}', '${actor}');
    raise exception 'Expired token was claimed after waiting for a lock';
  exception when others then
    if sqlerrm <> 'Booking access is unavailable' then raise; end if;
  end;
end;
$test$;
`;
  claimant = spawn('psql', [...args, '-c', claimSql], { stdio: ['ignore', 'pipe', 'pipe'], env: dbEnv });
  let claimErrors = '';
  claimant.stderr.setEncoding('utf8');
  claimant.stderr.on('data', (data) => { claimErrors += data; });
  const claimResult = new Promise((resolve) => {
    claimant.on('error', (error) => { claimErrors += error.message; resolve(null); });
    claimant.on('exit', (code) => resolve(code));
  });

  const deadline = Date.now() + 10000;
  let waiting = false;
  while (Date.now() < deadline) {
    const state = query(`
select
  exists(select 1 from pg_catalog.pg_stat_activity
    where application_name = '${application}' and wait_event_type = 'Lock')::int || '|' ||
  (select (expires_at > pg_catalog.clock_timestamp())::int
     from private.guest_booking_access_tokens
    where booking_id = '${booking}');
`);
    if (state === '1|1') {
      waiting = true;
      break;
    }
    if (state.endsWith('|0')) throw new Error('Token expired before the claim was observed waiting.');
    await sleep(100);
  }
  if (!waiting) throw new Error(`The claim was not observed waiting for the ${lockTarget} lock.`);

  holder.stdin.write(`
select pg_catalog.pg_sleep(greatest(0,
  pg_catalog.date_part('epoch', (
    select expires_at - pg_catalog.clock_timestamp()
      from private.guest_booking_access_tokens where booking_id = '${booking}'
  )) + 0.2));
commit;
\\echo holder_released
`);
  await waitForMarker('holder_released');
  const code = await claimResult;
  if (code !== 0) throw new Error(`Expired claim test failed: ${claimErrors}`);
  const unchanged = query(`
select (b.customer_user_id is null and t.claimed_at is null and t.revoked_at is null)::int
  from public.bookings as b
  join private.guest_booking_access_tokens as t on t.booking_id = b.id
 where b.id = '${booking}';
`);
  if (unchanged !== '1') throw new Error('An expired claim changed the fixture.');
  console.log(`guest claim expiry while waiting for the ${lockTarget} lock: passed`);
} finally {
  holder.stdin.end();
  if (claimant && claimant.exitCode === null) claimant.kill();
  if (holder.exitCode === null) holder.kill();
}
