import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { requiredRolesForPath } from '../utils/supabase/route-roles.ts';

test('only the exact guest driver invitation path is public', () => {
  assert.equal(requiredRolesForPath('/driver/invitation'), null);
  assert.equal(requiredRolesForPath('/driver/invitation/'), null);
  for (const path of ['/driver', '/driver/dashboard', '/driver/invitation/other', '/driver/other']) {
    assert.deepEqual(requiredRolesForPath(path), ['driver', 'admin', 'super_admin']);
  }
});

test('admin and customer paths retain their existing roles', () => {
  assert.deepEqual(requiredRolesForPath('/admin/bookings'), ['admin', 'super_admin', 'operator']);
  assert.deepEqual(requiredRolesForPath('/customer/dashboard'), ['customer']);
});

test('driver dashboard retains its server-side authentication layout', () => {
  const middleware = readFileSync(new URL('../utils/supabase/middleware.ts', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../app/driver/dashboard/layout.tsx', import.meta.url), 'utf8');
  assert.match(middleware, /requiredRolesForPath\(pathname\)/);
  assert.match(layout, /await getAuthenticatedContext\(\)/);
  assert.match(layout, /redirect\('\/login\?redirectTo=\/driver\/dashboard'\)/);
  assert.equal(existsSync(new URL('../app/driver/layout.tsx', import.meta.url)), false);
});
