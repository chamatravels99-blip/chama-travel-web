import { redirect } from 'next/navigation';
import { AuthorizationError, getAuthenticatedContext } from '@/lib/server/authorization';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let roles: string[];
  try {
    ({ roles } = await getAuthenticatedContext());
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect('/login?redirectTo=/customer/dashboard');
    }
    throw error;
  }
  if (!roles.includes('customer')) {
    redirect('/login?error=unauthorized');
  }

  return <>{children}</>;
}
