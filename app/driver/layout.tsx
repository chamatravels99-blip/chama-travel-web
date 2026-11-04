import { redirect } from 'next/navigation';
import { AuthorizationError, getAuthenticatedContext } from '@/lib/server/authorization';

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let roles: string[];
  try {
    ({ roles } = await getAuthenticatedContext());
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect('/login?redirectTo=/driver/dashboard');
    }
    throw error;
  }
  if (!roles.some((role) => ['driver', 'admin', 'super_admin'].includes(role))) {
    redirect('/login?error=unauthorized');
  }

  return <>{children}</>;
}
