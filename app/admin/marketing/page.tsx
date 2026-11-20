'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  Clipboard,
  Edit3,
  ExternalLink,
  Eye,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  type ApplicableServiceType,
  type BannerThemeVariant,
  formatApplicableServiceLabel,
  formatPromoDiscountLabel,
  type MarketingBannerRecord,
  type MarketingCustomerRecipient,
  type MarketingTemplateCategory,
  type MarketingTemplateRecord,
  normalizePromoCodeString,
  type PromoCodeRecord,
  type PromoCurrency,
  type PromoDiscountType,
  renderMarketingTemplate,
} from '@/lib/marketing';
import { customerWhatsAppUrl } from '@/lib/whatsapp';

type MarketingApiData = {
  promo_codes: PromoCodeRecord[];
  banners: MarketingBannerRecord[];
  active_banner: MarketingBannerRecord | null;
  templates: MarketingTemplateRecord[];
  customers: MarketingCustomerRecipient[];
  kpis: {
    active_promo_codes: number;
    total_promo_codes: number;
    total_redemptions: number;
    banner_live: boolean;
    templates_count: number;
  };
};

type ActiveTab = 'promo_codes' | 'website_banner' | 'whatsapp_outreach';

const TEMPLATE_CATEGORY_LABELS: Record<MarketingTemplateCategory, string> = {
  seasonal_offer: 'Seasonal & VIP Offer',
  review_request: 'Post-Trip Review Request',
  airport_promo: 'Airport Transfer Promo',
  follow_up: 'Inquiry Follow-Up',
};

function bannerThemeClasses(theme: BannerThemeVariant) {
  if (theme === 'amber') {
    return {
      bar: 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white',
      badge: 'bg-white/20 text-white border border-white/30',
      code: 'bg-amber-950/35 text-amber-100 border border-white/25',
      cta: 'bg-white text-amber-900 hover:bg-amber-50',
    };
  }
  if (theme === 'slate') {
    return {
      bar: 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white',
      badge: 'bg-blue-500/25 text-blue-200 border border-blue-400/30',
      code: 'bg-white/10 text-blue-200 border border-white/20',
      cta: 'bg-blue-500 text-white hover:bg-blue-400',
    };
  }
  return {
    bar: 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white',
    badge: 'bg-white/20 text-white border border-white/30',
    code: 'bg-emerald-950/40 text-emerald-100 border border-white/25',
    cta: 'bg-white text-emerald-900 hover:bg-emerald-50',
  };
}

export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('promo_codes');
  const [data, setData] = useState<MarketingApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  // Tab 1: Promo Code Modal State
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoTitleInput, setPromoTitleInput] = useState('');
  const [promoDiscountType, setPromoDiscountType] = useState<PromoDiscountType>('percentage');
  const [promoDiscountValue, setPromoDiscountValue] = useState('10');
  const [promoCurrency, setPromoCurrency] = useState<PromoCurrency>('USD');
  const [promoMinAmount, setPromoMinAmount] = useState('0');
  const [promoService, setPromoService] = useState<ApplicableServiceType>('all');
  const [promoMaxUses, setPromoMaxUses] = useState('');
  const [promoValidUntil, setPromoValidUntil] = useState('');
  const [promoIsActive, setPromoIsActive] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);

  // Tab 2: Website Offer Banner Form State
  const [bannerId, setBannerId] = useState<string | null>(null);
  const [bannerBadge, setBannerBadge] = useState('LIMITED OFFER');
  const [bannerHeadline, setBannerHeadline] = useState(
    'Get 10% OFF on 7+ Day Sri Lanka Round Tours — Use Code: WELCOME10'
  );
  const [bannerCtaLabel, setBannerCtaLabel] = useState('Claim Offer');
  const [bannerCtaLink, setBannerCtaLink] = useState('/tours');
  const [bannerPromoCode, setBannerPromoCode] = useState('WELCOME10');
  const [bannerTheme, setBannerTheme] = useState<BannerThemeVariant>('emerald');
  const [bannerIsActive, setBannerIsActive] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  // Tab 3: WhatsApp Outreach & Templates State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateCategory, setTemplateCategory] =
    useState<MarketingTemplateCategory>('seasonal_offer');
  const [templateBody, setTemplateBody] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Quick Send to Customer Widget State
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [customRecipientPhone, setCustomRecipientPhone] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedOutreachPromoCode, setSelectedOutreachPromoCode] = useState<string>('WELCOME10');
  const [customMessageOverride, setCustomMessageOverride] = useState<string | null>(null);
  const [copiedOutreachMsg, setCopiedOutreachMsg] = useState(false);

  const loadMarketingData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/marketing', { cache: 'no-store' });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: MarketingApiData;
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not load Marketing & Promotions data.');
      }

      setData(result.data);
      setNowMs(Date.now());
      setError('');

      // Sync Banner editor state from active/primary banner
      const primaryBanner = result.data.active_banner ?? result.data.banners[0] ?? null;
      if (primaryBanner) {
        setBannerId(primaryBanner.id);
        setBannerBadge(primaryBanner.badge_text ?? '');
        setBannerHeadline(primaryBanner.headline ?? '');
        setBannerCtaLabel(primaryBanner.cta_label ?? '');
        setBannerCtaLink(primaryBanner.cta_link ?? '/tours');
        setBannerPromoCode(primaryBanner.promo_code ?? '');
        setBannerTheme(primaryBanner.theme_variant ?? 'emerald');
        setBannerIsActive(Boolean(primaryBanner.is_active));
      }

      // Default selections for Tab 3 Outreach
      if (result.data.templates.length > 0) {
        setSelectedTemplateId((curr) => curr || result.data!.templates[0].id);
      }
      if (result.data.promo_codes.length > 0) {
        const firstActiveCode =
          result.data.promo_codes.find((p) => p.is_active)?.code ??
          result.data.promo_codes[0].code;
        setSelectedOutreachPromoCode((curr) => curr || firstActiveCode);
      }
      if (result.data.customers.length > 0) {
        setSelectedCustomerId((curr) => curr || result.data!.customers[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Marketing & Promotions data could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadMarketingData);
  }, [loadMarketingData]);

  // Promo Code Modal Openers
  function openCreatePromoModal() {
    setEditingPromoId(null);
    setPromoCodeInput('');
    setPromoTitleInput('');
    setPromoDiscountType('percentage');
    setPromoDiscountValue('10');
    setPromoCurrency('USD');
    setPromoMinAmount('0');
    setPromoService('all');
    setPromoMaxUses('');
    setPromoValidUntil('');
    setPromoIsActive(true);
    setError('');
    setShowPromoModal(true);
  }

  function openEditPromoModal(promo: PromoCodeRecord) {
    setEditingPromoId(promo.id);
    setPromoCodeInput(promo.code);
    setPromoTitleInput(promo.title);
    setPromoDiscountType(promo.discount_type);
    setPromoDiscountValue(String(promo.discount_value));
    setPromoCurrency(promo.currency === 'ALL' ? 'USD' : promo.currency);
    setPromoMinAmount(String(promo.min_booking_amount ?? 0));
    setPromoService(promo.applicable_service);
    setPromoMaxUses(promo.max_uses !== null ? String(promo.max_uses) : '');
    setPromoValidUntil(promo.valid_until ? promo.valid_until.slice(0, 10) : '');
    setPromoIsActive(promo.is_active);
    setError('');
    setShowPromoModal(true);
  }

  async function handleSavePromoCode(e: React.FormEvent) {
    e.preventDefault();
    setSavingPromo(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_promo_code',
          id: editingPromoId,
          code: normalizePromoCodeString(promoCodeInput),
          title: promoTitleInput.trim(),
          discount_type: promoDiscountType,
          discount_value: Number(promoDiscountValue),
          currency: promoDiscountType === 'percentage' ? 'ALL' : promoCurrency,
          min_booking_amount: Number(promoMinAmount) || 0,
          applicable_service: promoService,
          max_uses: promoMaxUses.trim() ? Number(promoMaxUses) : null,
          valid_until: promoValidUntil.trim() || null,
          is_active: promoIsActive,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save promo code.');
      }

      setShowPromoModal(false);
      setNotice(result.message || 'Promo code saved.');
      await loadMarketingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promo code could not be saved.');
    } finally {
      setSavingPromo(false);
    }
  }

  async function handleTogglePromoCode(promo: PromoCodeRecord) {
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_promo_code',
          id: promo.id,
          is_active: !promo.is_active,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not toggle promo code.');
      }
      setNotice(result.message || 'Promo code status updated.');
      await loadMarketingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update promo code.');
    }
  }

  async function handleDeletePromoCode(promo: PromoCodeRecord) {
    if (!window.confirm(`Delete promo code "${promo.code}" permanently?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_promo_code',
          id: promo.id,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not delete promo code.');
      }
      setNotice(result.message || 'Promo code deleted.');
      await loadMarketingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete promo code.');
    }
  }

  async function handleSaveBanner(overrideActive?: boolean) {
    const nextActive = overrideActive !== undefined ? overrideActive : bannerIsActive;
    setSavingBanner(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_banner',
          id: bannerId,
          badge_text: bannerBadge.trim() || null,
          headline: bannerHeadline.trim(),
          cta_label: bannerCtaLabel.trim() || null,
          cta_link: bannerCtaLink.trim() || null,
          promo_code: bannerPromoCode.trim() || null,
          theme_variant: bannerTheme,
          is_active: nextActive,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save website offer banner.');
      }
      setBannerIsActive(nextActive);
      setNotice(result.message || 'Website offer banner updated.');
      await loadMarketingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Website banner could not be saved.');
    } finally {
      setSavingBanner(false);
    }
  }

  function openCreateTemplateModal() {
    setEditingTemplateId(null);
    setTemplateTitle('');
    setTemplateCategory('seasonal_offer');
    setTemplateBody(
      'Hello {customer_name}! 🌴\n\nEnjoy our special Sri Lanka travel offer with *Chama Travels*. Use promo code *{promo_code}* at {website_url} for an instant discount on your next journey!'
    );
    setError('');
    setShowTemplateModal(true);
  }

  function openEditTemplateModal(tpl: MarketingTemplateRecord) {
    setEditingTemplateId(tpl.id);
    setTemplateTitle(tpl.title);
    setTemplateCategory(tpl.category);
    setTemplateBody(tpl.message_body);
    setError('');
    setShowTemplateModal(true);
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSavingTemplate(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_template',
          id: editingTemplateId,
          title: templateTitle.trim(),
          category: templateCategory,
          message_body: templateBody.trim(),
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save WhatsApp template.');
      }
      setShowTemplateModal(false);
      setNotice(result.message || 'WhatsApp template saved.');
      await loadMarketingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template could not be saved.');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate(tpl: MarketingTemplateRecord) {
    if (!window.confirm(`Delete WhatsApp template "${tpl.title}"?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_template',
          id: tpl.id,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not delete template.');
      }
      setNotice(result.message || 'Template deleted.');
      await loadMarketingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete template.');
    }
  }

  // Filtered customers for Tab 3 Quick Send Widget
  const filteredCustomers = useMemo(() => {
    const list = data?.customers ?? [];
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) =>
      [c.full_name, c.phone, c.whatsapp, c.email ?? '', c.country ?? '', c.last_booking_ref ?? '']
        .some((v) => v.toLowerCase().includes(needle))
    );
  }, [data?.customers, customerSearch]);

  const activeRecipient = useMemo(() => {
    if (selectedCustomerId === '__custom__') {
      return {
        full_name: customRecipientName.trim() || 'Valued Guest',
        phone: customRecipientPhone.trim(),
      };
    }
    const found = (data?.customers ?? []).find((c) => c.id === selectedCustomerId);
    return {
      full_name: found?.full_name || 'Valued Guest',
      phone: found?.whatsapp || found?.phone || '',
    };
  }, [selectedCustomerId, customRecipientName, customRecipientPhone, data?.customers]);

  const activeTemplate = useMemo(
    () => (data?.templates ?? []).find((t) => t.id === selectedTemplateId) ?? null,
    [data?.templates, selectedTemplateId]
  );

  const renderedOutreachMessage = useMemo(() => {
    if (customMessageOverride !== null) return customMessageOverride;
    const rawBody =
      activeTemplate?.message_body ??
      'Hello {customer_name}! Thank you for choosing Chama Travels ({website_url}). Use code {promo_code} on your next trip!';
    return renderMarketingTemplate(rawBody, {
      customerName: activeRecipient.full_name,
      promoCode: selectedOutreachPromoCode,
      websiteUrl:
        typeof window !== 'undefined' ? window.location.origin : 'https://chamatravels.com',
    });
  }, [
    customMessageOverride,
    activeTemplate,
    activeRecipient.full_name,
    selectedOutreachPromoCode,
  ]);

  const outreachWhatsAppUrl = useMemo(
    () => customerWhatsAppUrl(activeRecipient.phone, renderedOutreachMessage),
    [activeRecipient.phone, renderedOutreachMessage]
  );

  const previewTheme = bannerThemeClasses(bannerTheme);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <header className="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <Megaphone className="h-4 w-4" /> Growth, Offers &amp; Guest Outreach
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Marketing &amp; Promotions Center
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage discount promo codes, publish a dynamic website special offer banner, and send personalized WhatsApp review requests &amp; seasonal campaigns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreatePromoModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" /> + New Promo Code
          </button>
          <button
            type="button"
            onClick={() => void loadMarketingData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {/* Alerts */}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm"
        >
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <div className="flex-1 font-semibold">{notice}</div>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
          <div className="flex-1 font-semibold">{error}</div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top KPI Summary Bar */}
      <section aria-label="Marketing KPI summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Promo Codes
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Tag className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {data?.kpis.active_promo_codes ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Of {data?.kpis.total_promo_codes ?? 0} total configured codes
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Promo Redemptions
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {data?.kpis.total_redemptions ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Applied across guest bookings &amp; campaigns
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Website Offer Banner
            </span>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                data?.kpis.banner_live
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Eye className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {data?.kpis.banner_live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                Live on Site
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Off (Draft)
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Toggle anytime in Tab 2
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              WhatsApp Templates
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <MessageSquare className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {data?.kpis.templates_count ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ready for 1-click guest outreach &amp; reviews
          </p>
        </div>
      </section>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('promo_codes')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'promo_codes'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Tag className="h-4 w-4" /> 1. Promo &amp; Discount Codes ({data?.promo_codes.length ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('website_banner')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'website_banner'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sparkles className="h-4 w-4" /> 2. Website Special Offer Banner
          {data?.kpis.banner_live && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
              LIVE
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whatsapp_outreach')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'whatsapp_outreach'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="h-4 w-4" /> 3. WhatsApp Outreach &amp; Review Requests
        </button>
      </div>

      {/* =====================================================================
          TAB 1: PROMO & DISCOUNT CODES
         ===================================================================== */}
      {activeTab === 'promo_codes' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Promotional &amp; Discount Codes
              </h2>
              <p className="text-xs text-slate-500">
                Guests can validate these codes directly on the public booking form. Validated codes attach automatically to the booking notes for quotation pricing.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreatePromoModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm"
            >
              <Plus className="h-4 w-4" /> + Create Promo Code
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-600" />
              Loading promo codes…
            </div>
          ) : (data?.promo_codes ?? []).length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              No promo codes created yet. Click <b>+ Create Promo Code</b> to add your first discount code.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(data?.promo_codes ?? []).map((promo) => {
                const isExpired =
                  nowMs > 0 &&
                  Boolean(promo.valid_until) &&
                  new Date(promo.valid_until!).getTime() < nowMs;

                return (
                  <div
                    key={promo.id}
                    className={`flex flex-col justify-between gap-4 rounded-3xl border p-5 shadow-sm transition ${
                      promo.is_active && !isExpired
                        ? 'border-slate-200/90 bg-white'
                        : 'border-slate-200 bg-slate-50/80 opacity-85'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1 font-mono text-sm font-black tracking-wider text-emerald-950">
                            {promo.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(promo.code);
                              setCopiedCode(promo.code);
                              setTimeout(() => setCopiedCode(null), 2000);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                          >
                            {copiedCode === promo.code ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" /> Copied
                              </>
                            ) : (
                              <>
                                <Clipboard className="h-3 w-3" /> Copy
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-900 ring-1 ring-inset ring-blue-600/20">
                            {formatPromoDiscountLabel(promo)}
                          </span>
                          {isExpired ? (
                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase text-rose-800">
                              Expired
                            </span>
                          ) : promo.is_active ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-700">
                              Paused
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">{promo.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Service: <b>{formatApplicableServiceLabel(promo.applicable_service)}</b>
                          {Number(promo.min_booking_amount) > 0 && (
                            <>
                              {' '}
                              · Min Booking:{' '}
                              <b>
                                {promo.currency === 'ALL' ? 'USD/LKR ' : `${promo.currency} `}
                                {Number(promo.min_booking_amount).toLocaleString()}
                              </b>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-xs border border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Redemptions
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {promo.used_count}
                            {promo.max_uses !== null ? ` / ${promo.max_uses}` : ' (Unlimited)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Discount Type
                          </span>
                          <span className="font-semibold text-slate-800 capitalize">
                            {promo.discount_type}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Valid Until
                          </span>
                          <span className="font-semibold text-slate-800">
                            {promo.valid_until
                              ? new Date(promo.valid_until).toLocaleDateString('en-GB')
                              : 'No Expiry'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => void handleTogglePromoCode(promo)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          promo.is_active
                            ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            : 'bg-emerald-700 text-white hover:bg-emerald-800'
                        }`}
                      >
                        {promo.is_active ? 'Pause Code' : 'Activate Code'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPromoModal(promo)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePromoCode(promo)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          TAB 2: WEBSITE SPECIAL OFFER BANNER
         ===================================================================== */}
      {activeTab === 'website_banner' && (
        <section className="space-y-6">
          {/* Live Interactive Banner Preview */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Live Interactive Website Top Bar Preview
                </span>
                <h2 className="text-sm font-black text-slate-950">
                  How visitors see your Special Offer Banner at the top of chamatravels.com
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  bannerIsActive
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20'
                    : 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20'
                }`}
              >
                {bannerIsActive ? 'Currently Published Live' : 'Draft Preview (Hidden on Public Site)'}
              </span>
            </div>

            {/* Simulated Banner Bar */}
            <div className={`rounded-2xl px-4 py-3 shadow-md transition ${previewTheme.bar}`}>
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  {bannerBadge.trim() && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${previewTheme.badge}`}
                    >
                      {bannerBadge.trim()}
                    </span>
                  )}
                  <span className="font-bold text-xs sm:text-sm">
                    {bannerHeadline.trim() || 'Enter your special offer headline below…'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {bannerPromoCode.trim() && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[11px] font-black ${previewTheme.code}`}
                    >
                      CODE: {normalizePromoCodeString(bannerPromoCode)}
                    </span>
                  )}
                  {bannerCtaLabel.trim() && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-extrabold shadow-xs transition ${previewTheme.cta}`}
                    >
                      {bannerCtaLabel.trim()} →
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Banner Editor Form */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-950">
                  Configure Website Announcement &amp; Offer Banner
                </h3>
                <p className="text-xs text-slate-500">
                  Customize the headline, promo code badge, call-to-action link, and theme color.
                </p>
              </div>

              {/* Prominent Publish Toggle Switch */}
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bannerIsActive}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setBannerIsActive(next);
                      void handleSaveBanner(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-xs font-extrabold text-slate-900">
                    Publish Banner on Website
                  </span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs font-bold text-slate-700">
                Badge Pill Text
                <input
                  type="text"
                  value={bannerBadge}
                  onChange={(e) => setBannerBadge(e.target.value)}
                  placeholder="e.g. LIMITED OFFER / SEASONAL DEAL"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                Banner Headline <span className="text-rose-600">*</span>
                <input
                  type="text"
                  value={bannerHeadline}
                  onChange={(e) => setBannerHeadline(e.target.value)}
                  placeholder="e.g. Get 10% OFF on 7+ Day Sri Lanka Round Tours — Use Code: WELCOME10"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                CTA Button Label
                <input
                  type="text"
                  value={bannerCtaLabel}
                  onChange={(e) => setBannerCtaLabel(e.target.value)}
                  placeholder="e.g. Claim Offer / Explore Tours"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                CTA Destination Link
                <input
                  type="text"
                  value={bannerCtaLink}
                  onChange={(e) => setBannerCtaLink(e.target.value)}
                  placeholder="e.g. /tours or /booking"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Linked Promo Code (Copy Badge)
                <select
                  value={bannerPromoCode}
                  onChange={(e) => setBannerPromoCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                >
                  <option value="">None (No promo code badge)</option>
                  {(data?.promo_codes ?? []).map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {formatPromoDiscountLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Color Theme Selector */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700">Banner Color Theme</span>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    {
                      id: 'emerald',
                      label: 'Emerald Tropical (Recommended)',
                      dot: 'bg-emerald-600',
                    },
                    { id: 'amber', label: 'Warm Sunset Amber', dot: 'bg-amber-500' },
                    { id: 'slate', label: 'Royal Midnight Blue', dot: 'bg-blue-900' },
                  ] as const
                ).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setBannerTheme(theme.id)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                      bannerTheme === theme.id
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${theme.dot}`} />
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={savingBanner}
                onClick={() => void handleSaveBanner()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition"
              >
                <CheckCircle className="h-4 w-4" />
                {savingBanner
                  ? 'Saving Banner…'
                  : bannerIsActive
                    ? 'Save & Update Live Banner'
                    : 'Save Banner Settings'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 3: WHATSAPP OUTREACH & REVIEW REQUESTS
         ===================================================================== */}
      {activeTab === 'whatsapp_outreach' && (
        <section className="grid gap-6 lg:grid-cols-12">
          {/* Left Column (7 cols): Quick Send to Customer Widget */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    <Send className="h-3 w-3" /> 1-Click Personalized WhatsApp Outreach
                  </span>
                  <h2 className="mt-1 text-base font-black text-slate-950">
                    Quick Send Campaign or Review Request to Customer
                  </h2>
                </div>
              </div>

              {/* Step 1: Select Customer from CRM / Bookings */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-600" /> 1. Choose Customer Recipient
                  </label>
                  <div className="relative w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Filter customers…"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setCustomMessageOverride(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900"
                >
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.whatsapp || c.phone})
                      {c.country ? ` · ${c.country}` : ''} · {c.total_bookings} booking(s)
                      {c.vip_status === 'vip' ? ' ★ VIP' : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Recipient Name &amp; WhatsApp Number</option>
                </select>

                {selectedCustomerId === '__custom__' && (
                  <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Recipient Name
                      <input
                        type="text"
                        value={customRecipientName}
                        onChange={(e) => {
                          setCustomRecipientName(e.target.value);
                          setCustomMessageOverride(null);
                        }}
                        placeholder="e.g. Sonia"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      WhatsApp Phone Number
                      <input
                        type="text"
                        value={customRecipientPhone}
                        onChange={(e) => setCustomRecipientPhone(e.target.value)}
                        placeholder="e.g. +44 7700 900077"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Step 2: Select Message Template & Promo Code */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  2. Select WhatsApp Template
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      setCustomMessageOverride(null);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 normal-case"
                  >
                    {(data?.templates ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({TEMPLATE_CATEGORY_LABELS[t.category] ?? t.category})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  3. Insert Promo Code Tag
                  <select
                    value={selectedOutreachPromoCode}
                    onChange={(e) => {
                      setSelectedOutreachPromoCode(e.target.value);
                      setCustomMessageOverride(null);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 normal-case"
                  >
                    {(data?.promo_codes ?? []).map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} ({formatPromoDiscountLabel(p)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Step 3: Live Personalized Message Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    4. Personalized Message Preview (Editable before sending)
                  </span>
                  {customMessageOverride !== null && (
                    <button
                      type="button"
                      onClick={() => setCustomMessageOverride(null)}
                      className="text-[11px] font-bold text-blue-700 hover:underline"
                    >
                      Reset to Template
                    </button>
                  )}
                </div>
                <textarea
                  rows={9}
                  value={renderedOutreachMessage}
                  onChange={(e) => setCustomMessageOverride(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 p-3.5 font-sans text-xs leading-relaxed text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Actions: Send via WhatsApp or Copy */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  Recipient: <b className="text-slate-800">{activeRecipient.full_name}</b>{' '}
                  {activeRecipient.phone ? `(${activeRecipient.phone})` : '(No phone selected)'}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(renderedOutreachMessage);
                      setCopiedOutreachMsg(true);
                      setTimeout(() => setCopiedOutreachMsg(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                  >
                    {copiedOutreachMsg ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Clipboard className="h-4 w-4" /> Copy Message
                      </>
                    )}
                  </button>

                  {outreachWhatsAppUrl ? (
                    <a
                      href={outreachWhatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      <ExternalLink className="h-4 w-4" /> Send via WhatsApp
                    </a>
                  ) : (
                    <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      Select or enter a valid phone number for WhatsApp link
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Saved WhatsApp Templates Library */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-black text-slate-950">
                  Saved WhatsApp Templates
                </h3>
                <p className="text-xs text-slate-500">
                  Supports <code className="font-mono">{'{customer_name}'}</code>,{' '}
                  <code className="font-mono">{'{promo_code}'}</code>,{' '}
                  <code className="font-mono">{'{website_url}'}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateTemplateModal}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                <Plus className="h-3.5 w-3.5" /> + New Template
              </button>
            </div>

            <div className="space-y-3">
              {(data?.templates ?? []).map((tpl) => {
                const isSelected = tpl.id === selectedTemplateId;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setCustomMessageOverride(null);
                    }}
                    className={`rounded-3xl border p-4 transition cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                          {TEMPLATE_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                        </span>
                        <h4 className="mt-1 text-sm font-extrabold text-slate-950">{tpl.title}</h4>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openEditTemplateModal(tpl)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit template"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTemplate(tpl)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                          title="Delete template"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">
                      {tpl.message_body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MODAL 1: CREATE / EDIT PROMO CODE
         ===================================================================== */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Promotional Discount
                </span>
                <h2 className="text-lg font-black text-slate-950">
                  {editingPromoId ? 'Edit Promo Code' : 'Create New Promo Code'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPromoModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromoCode} className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Promo Code (Uppercase) <span className="text-rose-600">*</span>
                  <input
                    type="text"
                    required
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(normalizePromoCodeString(e.target.value))}
                    placeholder="e.g. WELCOME10"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-black uppercase text-slate-900"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Discount Type <span className="text-rose-600">*</span>
                  <select
                    value={promoDiscountType}
                    onChange={(e) =>
                      setPromoDiscountType(e.target.value as PromoDiscountType)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    <option value="percentage">Percentage (% OFF)</option>
                    <option value="fixed">Fixed Amount (USD / LKR OFF)</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                  Campaign Title / Description <span className="text-rose-600">*</span>
                  <input
                    type="text"
                    required
                    value={promoTitleInput}
                    onChange={(e) => setPromoTitleInput(e.target.value)}
                    placeholder="e.g. First-Time Guest Welcome Discount (10% OFF)"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Discount Value {promoDiscountType === 'percentage' ? '(%)' : ''} <span className="text-rose-600">*</span>
                  <input
                    type="number"
                    required
                    min={1}
                    max={promoDiscountType === 'percentage' ? 100 : 10000000}
                    step="0.01"
                    value={promoDiscountValue}
                    onChange={(e) => setPromoDiscountValue(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                  />
                </label>

                {promoDiscountType === 'fixed' ? (
                  <label className="block text-xs font-bold text-slate-700">
                    Currency
                    <select
                      value={promoCurrency}
                      onChange={(e) => setPromoCurrency(e.target.value as PromoCurrency)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="LKR">LKR (Rs.)</option>
                    </select>
                  </label>
                ) : (
                  <label className="block text-xs font-bold text-slate-700">
                    Currency Applicability
                    <input
                      type="text"
                      disabled
                      value="All Currencies (LKR & USD)"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500"
                    />
                  </label>
                )}

                <label className="block text-xs font-bold text-slate-700">
                  Applicable Service Category
                  <select
                    value={promoService}
                    onChange={(e) =>
                      setPromoService(e.target.value as ApplicableServiceType)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    <option value="all">All Services &amp; Tours</option>
                    <option value="round_tour">Multi-Day &amp; Chauffeur Tours</option>
                    <option value="airport_transfer">Airport Transfers</option>
                    <option value="day_trip">Day Trips</option>
                    <option value="vehicle_hire">Vehicle Hire / Point-to-Point</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Minimum Booking Amount
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={promoMinAmount}
                    onChange={(e) => setPromoMinAmount(e.target.value)}
                    placeholder="0 (No minimum)"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Max Redemptions <span className="font-normal text-slate-400">(Blank = Unlimited)</span>
                  <input
                    type="number"
                    min={1}
                    value={promoMaxUses}
                    onChange={(e) => setPromoMaxUses(e.target.value)}
                    placeholder="Unlimited"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Expiry Date <span className="font-normal text-slate-400">(Optional)</span>
                  <input
                    type="date"
                    value={promoValidUntil}
                    onChange={(e) => setPromoValidUntil(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoIsActive}
                  onChange={(e) => setPromoIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                />
                <span className="text-xs font-bold text-slate-800">
                  Promo code is active and redeemable on the public website
                </span>
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPromo}
                  className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingPromo ? 'Saving…' : editingPromoId ? 'Update Promo Code' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CREATE / EDIT WHATSAPP TEMPLATE
         ===================================================================== */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  WhatsApp Outreach &amp; Reviews
                </span>
                <h2 className="text-lg font-black text-slate-950">
                  {editingTemplateId ? 'Edit WhatsApp Template' : 'New WhatsApp Template'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Template Title <span className="text-rose-600">*</span>
                  <input
                    type="text"
                    required
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    placeholder="e.g. Post-Trip Review Request"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Category
                  <select
                    value={templateCategory}
                    onChange={(e) =>
                      setTemplateCategory(e.target.value as MarketingTemplateCategory)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    <option value="seasonal_offer">Seasonal &amp; VIP Offer</option>
                    <option value="review_request">Post-Trip Review Request</option>
                    <option value="airport_promo">Airport Transfer Promo</option>
                    <option value="follow_up">Inquiry Follow-Up</option>
                  </select>
                </label>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700">
                    Message Body <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {['{customer_name}', '{promo_code}', '{website_url}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTemplateBody((curr) => `${curr} ${tag}`)}
                        className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={8}
                  required
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {savingTemplate ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
