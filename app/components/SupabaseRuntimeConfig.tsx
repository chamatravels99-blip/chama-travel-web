import { connection } from 'next/server';

export default async function SupabaseRuntimeConfig() {
  await connection();
  return (
    <div
      id="supabase-runtime-config"
      hidden
      data-url={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
      data-anon-key={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}
    />
  );
}
