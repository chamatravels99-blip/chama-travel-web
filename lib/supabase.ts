import { createClient } from '@supabase/supabase-js';

// Build time එකේදී variables නැතිනම් placeholder values පාවිච්චි කරයි
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);