import { redirect } from 'next/navigation';
import { AuthorizationError, getAuthenticatedContext } from '@/lib/server/authorization';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let roles: string[];
  try {
    ({ roles } = await getAuthenticatedContext());
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect('/login?redirectTo=/admin/dashboard');
    }
    throw error;
  }
  if (!roles.some((role) => ['admin', 'super_admin', 'operator'].includes(role))) {
    redirect('/login?error=unauthorized');
  }

  return <>{children}</>;
}
