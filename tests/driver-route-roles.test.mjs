import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { requiredRolesForPath } from '../utils/supabase/route-roles.ts';

test('only Admin routes require application roles; guest invitation remains token-based', () => {
  assert.equal(requiredRolesForPath('/driver/invitation'), null);
  assert.equal(requiredRolesForPath('/driver/invitation/'), null);
  for (const path of ['/driver', '/driver/dashboard', '/driver/invitation/other', '/driver/other', '/customer/dashboard']) {
    assert.equal(requiredRolesForPath(path), null);
  }
  assert.deepEqual(requiredRolesForPath('/admin/bookings'), ['admin', 'super_admin']);
});

test('customer and driver dashboards and registration are removed while invitations remain', () => {
  for (const path of [
    '../app/customer/layout.tsx',
    '../app/customer/dashboard/page.tsx',
    '../app/driver/dashboard/page.tsx',
    '../app/driver/dashboard/layout.tsx',
    '../app/register/page.tsx',
    '../app/api/customer/bookings/route.ts',
    '../app/api/customer/quotes/accept/route.ts',
    '../app/api/customer/quotes/reject/route.ts',
    '../app/api/customer/payment-claims/route.ts',
    '../app/api/driver/assignments/route.ts',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, `${path} should be removed`);
  }
  assert.equal(existsSync(new URL('../app/api/admin/create-driver/route.ts', import.meta.url)), true);
  assert.equal(existsSync(new URL('../app/driver/invitation/page.tsx', import.meta.url)), true);
});
