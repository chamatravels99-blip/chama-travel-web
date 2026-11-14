import { redirect } from 'next/navigation';
import { AuthorizationError, getAuthenticatedContext } from '@/lib/server/authorization';
import SupabaseRuntimeConfig from '@/app/components/SupabaseRuntimeConfig';
import AdminShell from '@/app/admin/components/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let context: Awaited<ReturnType<typeof getAuthenticatedContext>>;
  try {
    context = await getAuthenticatedContext();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect('/login?redirectTo=/admin/dashboard');
    }
    throw error;
  }
  if (!context.roles.some((role) => ['admin', 'super_admin'].includes(role))) {
    redirect('/login?error=unauthorized');
  }

  const displayName = typeof context.user.user_metadata?.full_name === 'string'
    ? context.user.user_metadata.full_name
    : context.user.email ?? 'Admin user';

  return (
    <>
      <SupabaseRuntimeConfig />
      <AdminShell email={context.user.email ?? ''} displayName={displayName} roles={context.roles}>
        {children}
      </AdminShell>
    </>
  );
}
