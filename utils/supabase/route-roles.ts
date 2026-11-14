export function requiredRolesForPath(pathname: string): string[] | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return ['admin', 'super_admin', 'operator'];
  }
  if (pathname === '/driver/invitation' || pathname === '/driver/invitation/') {
    return null;
  }
  if (pathname === '/driver' || pathname.startsWith('/driver/')) {
    return ['driver', 'admin', 'super_admin'];
  }
  if (pathname === '/customer' || pathname.startsWith('/customer/')) {
    return ['customer'];
  }
  return null;
}
