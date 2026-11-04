import type { Metadata } from 'next';
import { PasswordResetForm } from './password-reset-form';

export const metadata: Metadata = {
  title: 'Reset your Chama Travels password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <PasswordResetForm updating={mode === 'update'} />;
}
