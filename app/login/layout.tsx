import SupabaseRuntimeConfig from '@/app/components/SupabaseRuntimeConfig';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SupabaseRuntimeConfig />
      {children}
    </>
  );
}
