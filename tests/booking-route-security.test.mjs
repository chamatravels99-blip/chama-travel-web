import { strict as assert } from 'node:assert';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Script } from 'node:vm';
import ts from 'typescript';

const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bookingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const token = 'a'.repeat(64);
const submissionToken = 'b'.repeat(64);

function loadModule(path, modules, env = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Script(compiled).runInNewContext({
    exports,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    process: { env },
    console: { info() {}, error() {} },
    Response, TextDecoder, TextEncoder, Uint8Array, URL, crypto: webcrypto,
  });
  return exports;
}

function harness({ user = null, userError = null, limitResponse = null, tokenResult = submissionToken, tokenError = null, enabled = true } = {}) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user }, error: userError }) },
    rpc: async (name, args) => {
      calls.push({ kind: 'browser-rpc', name, args });
      return { data: [{ booking_id: bookingId, booking_ref: 'TEST-BOOKING' }], error: null };
    },
  };
  const service = {
    rpc: async (name, args) => {
      calls.push({ kind: 'service-rpc', name, args });
      if (name === 'issue_guest_booking_tracker_token') {
        return { data: [{ token }], error: null };
      }
      if (name === 'issue_booking_submission_token') return { data: tokenResult, error: tokenError };
      return { data: [{ booking_id: bookingId, booking_ref: 'TEST-BOOKING' }], error: null };
    },
  };
  const modules = {
    'next/server': { NextResponse: { json: Response.json } },
    '@supabase/supabase-js': { isAuthSessionMissingError: (error) => error?.code === 'session_missing' },
    '@/utils/supabase/server': { createClient: async () => supabase },
    '@/lib/server/authorization': {
      isSameOriginRequest: (request) => request.headers.get('origin') === new URL(request.url).origin,
    },
    '@/lib/server/rate-limit': {
      enforceGuestRateLimit: async (_request, endpoint, identity) => {
        calls.push({ kind: 'limit', endpoint, identity });
        return limitResponse;
      },
    },
    '@/lib/server/service-client': { createServiceClient: () => service },
  };
  const route = loadModule('../app/api/bookings/route.ts', modules, {
    BOOKING_SERVER_RPC_ENABLED: String(enabled), NODE_ENV: 'test',
  });
  return { post: route.POST, calls };
}

function booking(overrides = {}) {
  return {
    name: 'Test Customer',
    email: 'customer@example.invalid',
    phone: '+94710000000',
    service_type: 'airport_transfer',
    vehicle_type: 'sedan',
    journey_type: 'one_way',
    pickup_location: 'Test pickup',
    dropoff_location: 'Test destination',
    pickup_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    pickup_time: '12:00',
    passengers: 1,
    luggage: 0,
    currency: 'LKR',
    idempotency_key: key,
    ...overrides,
  };
}

function request(body) {
  return new Request('https://example.invalid/api/bookings', {
    method: 'POST',
    headers: { origin: 'https://example.invalid', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('authenticated booking uses the verified session identity', async () => {
  const { post, calls } = harness({ user: { id: customerId } });
  const response = await post(request(booking()));
  assert.equal(response.status, 201);
  assert.deepEqual(calls.map((call) => call.kind), ['limit', 'service-rpc', 'browser-rpc']);
  assert.equal(calls[0].identity, customerId);
  assert.equal(calls[1].name, 'issue_booking_submission_token');
  assert.equal(calls[1].args.p_customer_user_id, customerId);
  assert.equal(calls[2].name, 'service_create_booking');
  assert.equal(calls[2].args.p_submission_token, submissionToken);
  assert.equal('p_customer_user_id' in calls[2].args, false);
  const { p_submission_token: ignored, ...submitted } = calls[2].args;
  assert.equal(ignored, submissionToken);
  assert.equal(JSON.stringify(submitted), JSON.stringify(calls[1].args.p_booking));
  assert.equal(JSON.stringify(await response.json()).includes(submissionToken), false);
});

test('browser-supplied customer identity is rejected before booking', async () => {
  for (const field of ['customer_user_id', 'p_customer_user_id']) {
    const { post, calls } = harness({ user: { id: customerId } });
    const response = await post(request(booking({ [field]: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })));
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  }
});

test('guest booking passes no customer identity and requests a tracker', async () => {
  const { post, calls } = harness();
  const response = await post(request(booking()));
  assert.equal(response.status, 201);
  assert.deepEqual(calls.map((call) => call.kind), ['limit', 'limit', 'service-rpc', 'browser-rpc', 'service-rpc']);
  assert.equal(calls[2].args.p_customer_user_id, null);
  assert.equal(calls[3].name, 'service_create_booking');
  assert.equal(calls[4].name, 'issue_guest_booking_tracker_token');
  const body = await response.json();
  assert.equal(body.data.tracker_token, token);
  assert.equal(JSON.stringify(body).includes(submissionToken), false);
});

test('both booking paths forward LKR and USD for guests and authenticated customers', async () => {
  for (const enabled of [false, true]) {
    for (const user of [null, { id: customerId }]) {
      for (const currency of ['LKR', 'USD']) {
        const { post, calls } = harness({ enabled, user });
        const response = await post(request(booking({ currency })));
        assert.equal(response.status, 201);
        const submitted = calls.find((call) => call.kind === 'browser-rpc');
        assert.equal(submitted.name, enabled ? 'service_create_booking' : 'create_booking');
        assert.equal(submitted.args.p_requested_currency, currency);
        assert.ok(calls.some((call) => call.kind === 'limit' && call.endpoint === 'booking_submit'));
        assert.equal(calls.some((call) => call.name === 'issue_booking_submission_token'), enabled);
        assert.equal(calls.some((call) => call.name === 'issue_guest_booking_tracker_token'), !user);
      }
    }
  }
});

test('one-way, return and multi-leg submissions preserve schedules and flight details', async () => {
  const date = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const leg = (day, pickup, dropoff) => ({
    pickup_location: pickup, dropoff_location: dropoff,
    pickup_date: date(day), pickup_time: '12:00',
  });
  const cases = [
    { fields: { flight_number: 'CT123', flight_arrival_date: date(60), flight_arrival_time: '11:00' }, count: 1 },
    { fields: { journey_type: 'return', return_date: date(61), return_time: '12:00',
      end_date: date(62), end_time: '12:00' }, count: 2 },
    { fields: { journey_type: 'multi_leg', legs: [leg(60, 'First', 'Second'), leg(61, 'Second', 'Third')] }, count: 2 },
  ];
  for (const { fields, count } of cases) {
    const { post, calls } = harness();
    assert.equal((await post(request(booking(fields)))).status, 201);
    const legs = calls.find((call) => call.name === 'service_create_booking').args.p_legs;
    assert.equal(legs.length, count);
    if (fields.flight_number) {
      assert.equal(legs[0].flight_number, 'CT123');
      assert.ok(legs[0].flight_arrival_at);
      assert.equal(legs[0].planned_end_at, null);
    }
    if (fields.journey_type === 'return') assert.ok(legs[1].planned_end_at);
    if (fields.journey_type === 'multi_leg') assert.equal(legs[1].planned_end_at, null);
  }
  const { post, calls } = harness();
  assert.equal((await post(request(booking({ end_date: date(61) })))).status, 400);
  assert.equal(calls.length, 0);
});

test('rate-limit refusal and session verification errors stop booking creation', async () => {
  for (const enabled of [false, true]) {
    for (const status of [429, 503]) {
      const { post, calls } = harness({
        user: { id: customerId }, enabled,
        limitResponse: Response.json({ error: 'unavailable' }, { status }),
      });
      assert.equal((await post(request(booking()))).status, status);
      assert.equal(calls.some((call) => call.kind.endsWith('rpc')), false);
    }
  }
  const { post, calls } = harness({ userError: { code: 'verification_failed' } });
  assert.equal((await post(request(booking()))).status, 503);
  assert.equal(calls.length, 0);
});

test('booking authorization errors stop creation and do not expose the token', async () => {
  for (const options of [{ tokenError: { code: 'unavailable' } }, { tokenResult: 'invalid' }]) {
    const { post, calls } = harness({ user: { id: customerId }, ...options });
    const response = await post(request(booking()));
    assert.equal(response.status, 503);
    assert.equal(calls.some((call) => call.kind === 'browser-rpc'), false);
    assert.equal(JSON.stringify(await response.json()).includes(submissionToken), false);
  }
});

test('booking retries pass the same idempotency key to the service RPC', async () => {
  const { post, calls } = harness({ user: { id: customerId } });
  assert.equal((await post(request(booking()))).status, 201);
  assert.equal((await post(request(booking()))).status, 201);
  assert.deepEqual(
    calls.filter((call) => call.kind === 'browser-rpc').map((call) => call.args.p_idempotency_key),
    [key, key]
  );
});

test('guest booking tracker does not allow linking a customer account', async () => {
  const calls = [];
  const route = loadModule('../app/api/guest/bookings/access/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/server/authorization': {
      isSameOriginRequest: () => true,
      requireRoles: async () => ({ user: { id: customerId } }),
      authorizationResponse: () => Response.json({ error: 'denied' }, { status: 403 }),
    },
    '@/lib/guest-booking-token': { isGuestBookingToken: (value) => value === token },
    '@/utils/supabase/server': { createClient: async () => ({}) },
    '@/lib/server/rate-limit': { enforceGuestRateLimit: async () => null },
    '@/lib/server/service-client': {
      createServiceClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { error: null };
        },
      }),
    },
  });
  const response = await route.POST(request({
    action: 'claim', token, user_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  }));
  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});

test('persistent booking limiter denies excess requests and fails closed on errors', async () => {
  for (const [result, expected] of [
    [{ data: [{ allowed: false, retry_after_seconds: 30 }], error: null }, 429],
    [{ data: null, error: { code: 'database_error' } }, 503],
    [{ data: [{ allowed: 'false', retry_after_seconds: 30 }], error: null }, 503],
    [{ data: [{ allowed: true, retry_after_seconds: 0 }], error: null }, 503],
  ]) {
    const limiter = loadModule('../lib/server/rate-limit.ts', {
      '@/lib/server/service-client': { createServiceClient: () => ({ rpc: async () => result }) },
    }, { RATE_LIMIT_SECRET: 'test-secret-at-least-16-characters' });
    const response = await limiter.enforceGuestRateLimit(request(booking()), 'booking_submit', customerId);
    assert.equal(response.status, expected);
  }
});

test('booking limiter checks both IP and identity buckets', async () => {
  const checks = [];
  const limiter = loadModule('../lib/server/rate-limit.ts', {
    '@/lib/server/service-client': {
      createServiceClient: () => ({
        rpc: async (name, args) => {
          checks.push({ name, args });
          return { data: [{ allowed: true, retry_after_seconds: 30 }], error: null };
        },
      }),
    },
  }, { RATE_LIMIT_SECRET: 'test-secret-at-least-16-characters' });
  assert.equal(await limiter.enforceGuestRateLimit(request(booking()), 'booking_submit', customerId), null);
  assert.deepEqual(checks.map((check) => check.name), ['check_rate_limit', 'check_rate_limit']);
  assert.deepEqual(checks.map((check) => check.args.p_limit), [40, 10]);
  assert.notEqual(checks[0].args.p_bucket_hash, checks[1].args.p_bucket_hash);
});

test('IP rate limiting ignores untrusted forwarding headers', () => {
  const modules = { '@/lib/server/service-client': {} };
  const req = new Request('https://example.invalid', {
    headers: {
      'cf-connecting-ip': '192.0.2.1',
      'x-real-ip': '192.0.2.2',
      'x-forwarded-for': '192.0.2.3',
    },
  });
  assert.equal(loadModule('../lib/server/rate-limit.ts', modules).clientAddress(req), 'unknown');
  assert.equal(
    loadModule('../lib/server/rate-limit.ts', modules, { TRUST_CLOUDFLARE_CLIENT_IP: 'true' }).clientAddress(req),
    '192.0.2.1'
  );
  const noCloudflareHeader = new Request('https://example.invalid', {
    headers: { 'x-real-ip': '192.0.2.2', 'x-forwarded-for': '192.0.2.3' },
  });
  assert.equal(
    loadModule('../lib/server/rate-limit.ts', modules, { TRUST_CLOUDFLARE_CLIENT_IP: 'true' }).clientAddress(noCloudflareHeader),
    'unknown'
  );
});
