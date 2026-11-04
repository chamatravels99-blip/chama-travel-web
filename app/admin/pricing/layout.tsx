import { redirect } from 'next/navigation';
import { getAuthenticatedContext } from '@/lib/server/authorization';

export default async function PricingAdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const { roles } = await getAuthenticatedContext();
    if (!roles.some((role) => role === 'admin' || role === 'super_admin')) redirect('/login?error=unauthorized');
  } catch {
    redirect('/login?error=unauthorized');
  }
  return <>{children}</>;
}
