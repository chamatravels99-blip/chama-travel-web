export function requiredRolesForPath(pathname: string): string[] | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return ['admin', 'super_admin'];
  }
  return null;
}
