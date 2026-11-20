'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Clipboard, Sparkles, X } from 'lucide-react';
import type { BannerThemeVariant, MarketingBannerRecord } from '@/lib/marketing';

const DISMISSED_STORAGE_KEY = 'chama-dismissed-banner-id-v1';

function getThemeStyles(theme: BannerThemeVariant | undefined) {
  if (theme === 'amber') {
    return {
      wrapper:
        'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white border-b border-amber-400/30',
      badge: 'bg-white/20 text-white border border-white/30',
      codeBtn:
        'bg-amber-950/35 text-amber-50 border border-white/30 hover:bg-amber-950/50',
      ctaBtn: 'bg-white text-amber-950 hover:bg-amber-50',
    };
  }
  if (theme === 'slate') {
    return {
      wrapper:
        'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-blue-400/20',
      badge: 'bg-blue-500/25 text-blue-200 border border-blue-400/30',
      codeBtn: 'bg-white/10 text-blue-100 border border-white/20 hover:bg-white/20',
      ctaBtn: 'bg-blue-500 text-white hover:bg-blue-400',
    };
  }
  return {
    wrapper:
      'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white border-b border-emerald-400/25',
    badge: 'bg-white/20 text-white border border-white/30',
    codeBtn:
      'bg-emerald-950/40 text-emerald-100 border border-white/25 hover:bg-emerald-950/60',
    ctaBtn: 'bg-white text-emerald-950 hover:bg-emerald-50',
  };
}

export default function PromoOfferBanner() {
  const [banner, setBanner] = useState<MarketingBannerRecord | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchBanner() {
      try {
        const res = await fetch('/api/marketing', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as {
          success?: boolean;
          data?: { banner?: MarketingBannerRecord | null };
        };
        const activeBanner = json.data?.banner ?? null;
        if (!cancelled && activeBanner && activeBanner.is_active) {
          try {
            const dismissedId = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
            if (dismissedId === `${activeBanner.id}:${activeBanner.updated_at}`) {
              return;
            }
          } catch {
            // Ignore sessionStorage errors
          }
          setBanner(activeBanner);
        }
      } catch {
        // Non-blocking fallback
      }
    }
    void fetchBanner();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!banner || !banner.is_active || dismissed) {
    return null;
  }

  const styles = getThemeStyles(banner.theme_variant);

  return (
    <div
      role="region"
      aria-label="Special promotional offer"
      className={`relative z-40 w-full px-3 py-2 shadow-md backdrop-blur-md transition ${styles.wrapper}`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {banner.badge_text && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${styles.badge}`}
            >
              <Sparkles className="h-3 w-3" />
              {banner.badge_text}
            </span>
          )}
          <span className="font-bold text-xs sm:text-sm">{banner.headline}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {banner.promo_code && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(banner.promo_code!);
                try {
                  sessionStorage.setItem('chama-copied-promo-code', banner.promo_code!);
                } catch {
                  // Ignore storage restrictions
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              title="Click to copy promo code"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[11px] font-black transition ${styles.codeBtn}`}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> COPIED: {banner.promo_code}
                </>
              ) : (
                <>
                  <Clipboard className="h-3 w-3" /> CODE: {banner.promo_code}
                </>
              )}
            </button>
          )}

          {banner.cta_label && banner.cta_link && (
            <Link
              href={banner.cta_link}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-extrabold shadow-xs transition ${styles.ctaBtn}`}
            >
              {banner.cta_label} →
            </Link>
          )}

          <button
            type="button"
            aria-label="Dismiss promotional offer banner"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(
                  DISMISSED_STORAGE_KEY,
                  `${banner.id}:${banner.updated_at}`
                );
              } catch {
                // Ignore storage errors
              }
            }}
            className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
