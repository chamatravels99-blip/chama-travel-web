import { redirect } from 'next/navigation';
import { AuthorizationError, requireRoles } from '@/lib/server/authorization';

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRoles(['admin', 'super_admin']);
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect('/login?redirectTo=/admin/users');
    }
    if (error instanceof AuthorizationError && error.status === 403) {
      redirect('/admin/dashboard?error=unauthorized');
    }
    throw error;
  }

  return children;
}
