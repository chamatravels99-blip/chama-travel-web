'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  normalizeSiteSettingsRow,
  type PublicSiteSettings,
  toPublicSiteSettings,
} from '@/lib/site-settings';

let cachedSettings: PublicSiteSettings | null = null;
let inflightPromise: Promise<PublicSiteSettings> | null = null;

async function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  if (cachedSettings) return cachedSettings;
  if (!inflightPromise) {
    inflightPromise = fetch('/api/settings/public', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return DEFAULT_PUBLIC_SITE_SETTINGS;
        const json = (await res.json()) as {
          success?: boolean;
          data?: Partial<PublicSiteSettings>;
        };
        if (json.success && json.data) {
          const normalized = toPublicSiteSettings(normalizeSiteSettingsRow(json.data));
          cachedSettings = normalized;
          return normalized;
        }
        return DEFAULT_PUBLIC_SITE_SETTINGS;
      })
      .catch(() => DEFAULT_PUBLIC_SITE_SETTINGS)
      .finally(() => {
        inflightPromise = null;
      });
  }
  return inflightPromise;
}

export function usePublicSiteSettings(): PublicSiteSettings {
  const [settings, setSettings] = useState<PublicSiteSettings>(
    () => cachedSettings ?? DEFAULT_PUBLIC_SITE_SETTINGS
  );

  useEffect(() => {
    let active = true;
    void fetchPublicSiteSettings().then((loaded) => {
      if (active) setSettings(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
