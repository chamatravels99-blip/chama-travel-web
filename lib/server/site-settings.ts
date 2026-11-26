import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettingsRow,
  type SiteSettings,
} from '@/lib/site-settings';

export async function getServerSiteSettings(
  existingClient?: SupabaseClient
): Promise<SiteSettings> {
  try {
    const supabase = existingClient ?? (await createClient());
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_SITE_SETTINGS };
    }
    return normalizeSiteSettingsRow(data);
  } catch {
    return { ...DEFAULT_SITE_SETTINGS };
  }
}
