import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const runtime = typeof document === 'undefined'
    ? undefined
    : document.getElementById('supabase-runtime-config')?.dataset;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || runtime?.url || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || runtime?.anonKey || ''
  );
}