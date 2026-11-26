'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { AppRole } from '@/lib/server/authorization';
import {
  buildWhatsAppUrl,
  DEFAULT_SITE_SETTINGS,
  normalizeWhatsAppDigits,
  QUOTE_VALIDITY_PRESETS,
  type SettingsCurrency,
  type SiteSettings,
} from '@/lib/site-settings';

type ActiveTab = 'business' | 'billing' | 'hero' | 'account';

type AccountInfo = {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Not saved yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('business');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Tab 1: Business & Contact Info
  const [businessName, setBusinessName] = useState(DEFAULT_SITE_SETTINGS.business_name);
  const [tagline, setTagline] = useState(DEFAULT_SITE_SETTINGS.tagline);
  const [primaryPhone, setPrimaryPhone] = useState(DEFAULT_SITE_SETTINGS.primary_phone);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_SITE_SETTINGS.whatsapp_number);
  const [contactEmail, setContactEmail] = useState(DEFAULT_SITE_SETTINGS.contact_email);
  const [officeAddress, setOfficeAddress] = useState(DEFAULT_SITE_SETTINGS.office_address);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [facebookUrl, setFacebookUrl] = useState(DEFAULT_SITE_SETTINGS.facebook_url ?? '');
  const [instagramUrl, setInstagramUrl] = useState(DEFAULT_SITE_SETTINGS.instagram_url ?? '');
  const [tripadvisorUrl, setTripadvisorUrl] = useState(DEFAULT_SITE_SETTINGS.tripadvisor_url ?? '');
  const [googleReviewUrl, setGoogleReviewUrl] = useState(
    DEFAULT_SITE_SETTINGS.google_review_url ?? ''
  );
  const [savingBusiness, setSavingBusiness] = useState(false);

  // Tab 2: Booking, Quotation & Billing Defaults
  const [defaultCurrency, setDefaultCurrency] = useState<SettingsCurrency>(
    DEFAULT_SITE_SETTINGS.default_currency
  );
  const [defaultQuoteValidityHours, setDefaultQuoteValidityHours] = useState<number>(
    DEFAULT_SITE_SETTINGS.default_quote_validity_hours
  );
  const [bankAccountDetails, setBankAccountDetails] = useState('');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(
    DEFAULT_SITE_SETTINGS.invoice_footer_note
  );
  const [savingBilling, setSavingBilling] = useState(false);

  // Tab 3: Website Hero & Booking Switch
  const [heroBadge, setHeroBadge] = useState(DEFAULT_SITE_SETTINGS.hero_badge);
  const [heroTitle, setHeroTitle] = useState(DEFAULT_SITE_SETTINGS.hero_title);
  const [heroSubtitle, setHeroSubtitle] = useState(DEFAULT_SITE_SETTINGS.hero_subtitle);
  const [heroImageUrl, setHeroImageUrl] = useState(DEFAULT_SITE_SETTINGS.hero_image_url);
  const [acceptingPublicBookings, setAcceptingPublicBookings] = useState(true);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [savingHero, setSavingHero] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  // Tab 4: My Account & Security
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const hydrateFromSettings = useCallback((s: SiteSettings) => {
    setBusinessName(s.business_name);
    setTagline(s.tagline);
    setPrimaryPhone(s.primary_phone);
    setWhatsappNumber(s.whatsapp_number);
    setContactEmail(s.contact_email);
    setOfficeAddress(s.office_address);
    setRegistrationNumber(s.registration_number ?? '');
    setFacebookUrl(s.facebook_url ?? '');
    setInstagramUrl(s.instagram_url ?? '');
    setTripadvisorUrl(s.tripadvisor_url ?? '');
    setGoogleReviewUrl(s.google_review_url ?? '');
    setDefaultCurrency(s.default_currency);
    setDefaultQuoteValidityHours(s.default_quote_validity_hours);
    setBankAccountDetails(s.bank_account_details ?? '');
    setInvoiceFooterNote(s.invoice_footer_note);
    setHeroBadge(s.hero_badge);
    setHeroTitle(s.hero_title);
    setHeroSubtitle(s.hero_subtitle);
    setHeroImageUrl(s.hero_image_url);
    setAcceptingPublicBookings(s.accepting_public_bookings);
    setUpdatedAt(s.updated_at);
  }, []);

  const fetchAndHydrateSettings = useCallback(async () => {
    const response = await fetch('/api/admin/settings', { cache: 'no-store' });
    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
      data?: {
        settings: SiteSettings;
        roles: AppRole[];
        is_super_admin: boolean;
        account: AccountInfo;
      };
    };

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error || 'System settings could not be loaded.');
    }

    hydrateFromSettings(result.data.settings);
    setIsSuperAdmin(result.data.is_super_admin);
    setAccount(result.data.account);
    setDisplayNameInput(result.data.account.full_name);
  }, [hydrateFromSettings]);

  const loadSettings = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      await fetchAndHydrateSettings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the settings service. Please check your connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAndHydrateSettings]);

  useEffect(() => {
    let active = true;
    async function loadInitialSettings() {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        const result = (await response.json()) as {
          success?: boolean;
          error?: string;
          data?: {
            settings: SiteSettings;
            roles: AppRole[];
            is_super_admin: boolean;
            account: AccountInfo;
          };
        };

        if (!active) return;
        if (!response.ok || !result.success || !result.data) {
          setError(result.error || 'System settings could not be loaded.');
          return;
        }

        hydrateFromSettings(result.data.settings);
        setIsSuperAdmin(result.data.is_super_admin);
        setAccount(result.data.account);
        setDisplayNameInput(result.data.account.full_name);
      } catch {
        if (active) {
          setError('Unable to reach the settings service. Please check your connection.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialSettings();
    return () => {
      active = false;
    };
  }, [hydrateFromSettings]);

  const showToast = (msg: string) => {
    setError('');
    setNotice(msg);
  };

  async function saveBusinessSection(e: React.FormEvent) {
    e.preventDefault();
    setSavingBusiness(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'business_contact',
          business_name: businessName,
          tagline,
          primary_phone: primaryPhone,
          whatsapp_number: whatsappNumber,
          contact_email: contactEmail,
          office_address: officeAddress,
          registration_number: registrationNumber,
          facebook_url: facebookUrl,
          instagram_url: instagramUrl,
          tripadvisor_url: tripadvisorUrl,
          google_review_url: googleReviewUrl,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: SiteSettings;
        message?: string;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) {
        setError(result.error || 'Could not save business & contact settings.');
        return;
      }
      hydrateFromSettings(result.data);
      showToast(result.message || 'Business & contact settings saved.');
    } catch {
      setError('Failed to save business & contact settings.');
    } finally {
      setSavingBusiness(false);
    }
  }

  async function saveBillingSection(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setSavingBilling(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'billing_defaults',
          default_currency: defaultCurrency,
          default_quote_validity_hours: Number(defaultQuoteValidityHours),
          bank_account_details: bankAccountDetails,
          invoice_footer_note: invoiceFooterNote,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: SiteSettings;
        message?: string;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) {
        setError(result.error || 'Could not save billing defaults.');
        return;
      }
      hydrateFromSettings(result.data);
      showToast(result.message || 'Booking, quotation & billing defaults saved.');
    } catch {
      setError('Failed to save billing defaults.');
    } finally {
      setSavingBilling(false);
    }
  }

  async function handleHeroImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !isSuperAdmin) return;
    setUploadingHeroImage(true);
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/admin/settings/upload', {
        method: 'POST',
        body: formData,
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: { publicUrl: string; path: string };
        error?: string;
      };
      if (!response.ok || !result.success || !result.data?.publicUrl) {
        setError(result.error || 'Hero image upload failed.');
        return;
      }
      setHeroImageUrl(result.data.publicUrl);
      showToast('Hero image uploaded to storage. Click "Save Website Settings" to publish it live.');
    } catch {
      setError('Hero image upload failed. Please try again.');
    } finally {
      setUploadingHeroImage(false);
      if (heroFileInputRef.current) {
        heroFileInputRef.current.value = '';
      }
    }
  }

  async function saveHeroSection(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setSavingHero(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'website_hero',
          hero_badge: heroBadge,
          hero_title: heroTitle,
          hero_subtitle: heroSubtitle,
          hero_image_url: heroImageUrl,
          accepting_public_bookings: acceptingPublicBookings,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: SiteSettings;
        message?: string;
        error?: string;
      };
      if (!response.ok || !result.success || !result.data) {
        setError(result.error || 'Could not save website hero settings.');
        return;
      }
      hydrateFromSettings(result.data);
      showToast(result.message || 'Website hero & booking settings saved.');
    } catch {
      setError('Failed to save website hero settings.');
    } finally {
      setSavingHero(false);
    }
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'account_profile',
          full_name: displayNameInput,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: { full_name: string };
        message?: string;
        error?: string;
      };
      if (!response.ok || !result.success) {
        setError(result.error || 'Display name could not be updated.');
        return;
      }
      setAccount((prev) =>
        prev ? { ...prev, full_name: result.data?.full_name ?? displayNameInput.trim() } : prev
      );
      showToast(result.message || 'Display name updated.');
      router.refresh();
    } catch {
      setError('Failed to update display name.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message || 'Password could not be updated.');
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      showToast('Your password has been updated securely.');
    } catch {
      setError('Unable to update password right now. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  }

  const normalizedWaPreview = normalizeWhatsAppDigits(whatsappNumber, '');
  const waPreviewHref = normalizedWaPreview ? buildWhatsAppUrl(normalizedWaPreview) : '';

  const tabs: Array<{ id: ActiveTab; label: string; shortLabel: string; icon: typeof Building2 }> = [
    { id: 'business', label: 'Business & Contact Info', shortLabel: 'Business', icon: Building2 },
    { id: 'billing', label: 'Booking & Billing Defaults', shortLabel: 'Billing', icon: CreditCard },
    { id: 'hero', label: 'Website Hero & Bookings', shortLabel: 'Website', icon: Globe },
    { id: 'account', label: 'My Account & Security', shortLabel: 'Account', icon: KeyRound },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                System &amp; Business Settings
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  isSuperAdmin
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manage public contact details, invoice billing instructions, homepage hero content, and your account security.
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              Last updated: <span className="text-slate-600">{formatTimestamp(updatedAt)}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 sm:self-center"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* 4-Tab Navigation */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs lg:grid-cols-4"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveTab(tab.id);
                setError('');
                setNotice('');
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-12">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Loading system settings…
          </div>
        </div>
      ) : (
        <>
          {/* ================= TAB 1: BUSINESS & CONTACT INFO ================= */}
          {activeTab === 'business' && (
            <form onSubmit={saveBusinessSection} className="space-y-6">
              {!isSuperAdmin && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    As an <strong>Admin</strong>, you can update operational contact numbers, email, office address, and social links. Brand identity &amp; registration fields require a <strong>Super Admin</strong>.
                  </span>
                </div>
              )}

              {/* Brand Identity */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Business Identity</h2>
                    <p className="text-xs text-slate-500">
                      Displayed across the public website footer, contact page, and generated PDF invoices.
                    </p>
                  </div>
                  {!isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Lock className="h-3 w-3" /> Super Admin
                    </span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="business_name"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Business Name
                    </label>
                    <input
                      id="business_name"
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="registration_number"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Registration / SLTDA Number
                    </label>
                    <input
                      id="registration_number"
                      type="text"
                      disabled={!isSuperAdmin}
                      placeholder="e.g. SLTDA/SQA/PRO/TA/00123"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="tagline"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Brand Tagline
                    </label>
                    <input
                      id="tagline"
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Channels */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <h2 className="text-base font-bold text-slate-900">Contact &amp; WhatsApp Channels</h2>
                <p className="mb-4 text-xs text-slate-500">
                  Changes sync immediately to the homepage, contact page, footer, and WhatsApp booking links.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="primary_phone"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Primary Phone Number
                    </label>
                    <input
                      id="primary_phone"
                      type="text"
                      required
                      placeholder="+94 71 111 4901"
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="whatsapp_number"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      WhatsApp Number (International Digits)
                    </label>
                    <input
                      id="whatsapp_number"
                      type="text"
                      required
                      placeholder="94711114901"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                      <span className="inline-flex items-center gap-1.5 truncate font-mono">
                        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {waPreviewHref || 'Enter 7–15 digits (e.g. 94711114901)'}
                      </span>
                      {waPreviewHref && (
                        <a
                          href={waPreviewHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-700 hover:underline"
                        >
                          Test <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact_email"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Official Email
                    </label>
                    <input
                      id="contact_email"
                      type="email"
                      required
                      placeholder="info@chamatravels.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="office_address"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Office Address
                    </label>
                    <input
                      id="office_address"
                      type="text"
                      required
                      placeholder="152/1 Kahambilihena, Udathuththiripitiya, Gampaha, Sri Lanka"
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <h2 className="text-base font-bold text-slate-900">Social &amp; Review Links</h2>
                <p className="mb-4 text-xs text-slate-500">
                  Leave any field blank to hide that channel from public social link bars.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="facebook_url"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Facebook URL
                    </label>
                    <input
                      id="facebook_url"
                      type="url"
                      placeholder="https://www.facebook.com/..."
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="instagram_url"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Instagram URL
                    </label>
                    <input
                      id="instagram_url"
                      type="url"
                      placeholder="https://www.instagram.com/..."
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tripadvisor_url"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      TripAdvisor URL
                    </label>
                    <input
                      id="tripadvisor_url"
                      type="url"
                      placeholder="https://www.tripadvisor.com/..."
                      value={tripadvisorUrl}
                      onChange={(e) => setTripadvisorUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="google_review_url"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Google Review / Maps URL
                    </label>
                    <input
                      id="google_review_url"
                      type="url"
                      placeholder="https://www.google.com/maps/..."
                      value={googleReviewUrl}
                      onChange={(e) => setGoogleReviewUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
                <p className="text-xs text-slate-500">
                  Last saved: <span className="font-semibold text-slate-700">{formatTimestamp(updatedAt)}</span>
                </p>
                <button
                  type="submit"
                  disabled={savingBusiness}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingBusiness ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingBusiness ? 'Saving Settings…' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}

          {/* ================= TAB 2: BOOKING, QUOTATION & BILLING DEFAULTS ================= */}
          {activeTab === 'billing' && (
            <form onSubmit={saveBillingSection} className="space-y-6">
              {!isSuperAdmin && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Financial, bank transfer, and invoice defaults are read-only for <strong>Admin</strong> accounts. Contact a <strong>Super Admin</strong> to update these settings.
                  </span>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <h2 className="text-base font-bold text-slate-900">
                  Currency &amp; Quotation Expiry Defaults
                </h2>
                <p className="mb-5 text-xs text-slate-500">
                  Configure the default billing currency and standard validity window for newly issued customer quotations.
                </p>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Default Currency
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {(['USD', 'LKR'] as const).map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          disabled={!isSuperAdmin}
                          onClick={() => setDefaultCurrency(curr)}
                          className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            defaultCurrency === curr
                              ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <p className="text-sm font-black">{curr}</p>
                          <p className="text-[11px] text-slate-500">
                            {curr === 'USD' ? 'US Dollars ($)' : 'Sri Lankan Rupees (Rs.)'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="default_quote_validity_hours"
                      className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Default Quotation Validity (Hours)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {QUOTE_VALIDITY_PRESETS.map((preset) => (
                        <button
                          key={preset.hours}
                          type="button"
                          disabled={!isSuperAdmin}
                          onClick={() => setDefaultQuoteValidityHours(preset.hours)}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            defaultQuoteValidityHours === preset.hours
                              ? 'border-blue-600 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        id="default_quote_validity_hours"
                        type="number"
                        min={1}
                        max={720}
                        required
                        disabled={!isSuperAdmin}
                        value={defaultQuoteValidityHours}
                        onChange={(e) => setDefaultQuoteValidityHours(Number(e.target.value) || 48)}
                        className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="text-xs text-slate-500">hours (1 – 720)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <h2 className="text-base font-bold text-slate-900">
                  Bank Transfer Details &amp; Invoice Footer
                </h2>
                <p className="mb-5 text-xs text-slate-500">
                  Automatically printed on generated PDF Invoices and Payment Receipts.
                </p>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="bank_account_details"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Bank Transfer Account Details
                    </label>
                    <textarea
                      id="bank_account_details"
                      rows={5}
                      disabled={!isSuperAdmin}
                      placeholder={
                        'Bank Name: Commercial Bank of Ceylon PLC\nAccount Name: Chama Travel & Tours\nAccount Number: 1000-XXXX-XXXX\nBranch: Gampaha Branch\nSWIFT Code: CCEYLKLX'
                      }
                      value={bankAccountDetails}
                      onChange={(e) => setBankAccountDetails(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Leave blank to show &ldquo;bank details shared upon request&rdquo; on generated invoices.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="invoice_footer_note"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Invoice &amp; Receipt Footer Note
                    </label>
                    <input
                      id="invoice_footer_note"
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={invoiceFooterNote}
                      onChange={(e) => setInvoiceFooterNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
                      <span className="font-bold text-slate-400">PDF Footer Preview: </span>
                      <span className="font-semibold text-slate-800">{invoiceFooterNote}</span>
                      {' · '}24/7 Hotline: {primaryPhone} · {contactEmail}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
                <p className="text-xs text-slate-500">
                  Last saved: <span className="font-semibold text-slate-700">{formatTimestamp(updatedAt)}</span>
                </p>
                <button
                  type="submit"
                  disabled={!isSuperAdmin || savingBilling}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingBilling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingBilling ? 'Saving Settings…' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}

          {/* ================= TAB 3: WEBSITE HERO & BOOKING SWITCH ================= */}
          {activeTab === 'hero' && (
            <form onSubmit={saveHeroSection} className="space-y-6">
              {!isSuperAdmin && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Website hero banner and online booking switch controls are restricted to <strong>Super Admin</strong> accounts.
                  </span>
                </div>
              )}

              {/* Accepting Online Bookings Toggle */}
              <div
                className={`rounded-2xl border p-5 shadow-xs sm:p-6 ${
                  acceptingPublicBookings
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          acceptingPublicBookings ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <h2 className="text-base font-bold text-slate-900">
                        Accepting Online Website Bookings
                      </h2>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {acceptingPublicBookings
                        ? 'Public booking form at /booking is LIVE and accepting new online reservation requests.'
                        : 'Public booking form is currently PAUSED. Visitors will see a friendly notice directing them to WhatsApp instead.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={acceptingPublicBookings}
                    disabled={!isSuperAdmin}
                    onClick={() => setAcceptingPublicBookings((prev) => !prev)}
                    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                      acceptingPublicBookings ? 'bg-emerald-600' : 'bg-slate-400'
                    }`}
                  >
                    <span className="sr-only">Toggle accepting online website bookings</span>
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                        acceptingPublicBookings ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Hero Content & Image Uploader */}
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
                  <h2 className="text-base font-bold text-slate-900">Home Page Hero Content</h2>

                  <div>
                    <label
                      htmlFor="hero_badge"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Hero Badge
                    </label>
                    <input
                      id="hero_badge"
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={heroBadge}
                      onChange={(e) => setHeroBadge(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="hero_title"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Hero Headline
                    </label>
                    <input
                      id="hero_title"
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={heroTitle}
                      onChange={(e) => setHeroTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="hero_subtitle"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Hero Subtitle
                    </label>
                    <textarea
                      id="hero_subtitle"
                      rows={3}
                      required
                      disabled={!isSuperAdmin}
                      value={heroSubtitle}
                      onChange={(e) => setHeroSubtitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="hero_image_url"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                    >
                      Hero Background Image
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        ref={heroFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        disabled={!isSuperAdmin || uploadingHeroImage}
                        onChange={(e) => void handleHeroImageUpload(e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={!isSuperAdmin || uploadingHeroImage}
                        onClick={() => heroFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploadingHeroImage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadingHeroImage ? 'Uploading…' : 'Upload Hero Image'}
                      </button>
                      <button
                        type="button"
                        disabled={!isSuperAdmin}
                        onClick={() => setHeroImageUrl(DEFAULT_SITE_SETTINGS.hero_image_url)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset Default
                      </button>
                    </div>
                    <input
                      id="hero_image_url"
                      type="text"
                      required
                      disabled={!isSuperAdmin}
                      value={heroImageUrl}
                      onChange={(e) => setHeroImageUrl(e.target.value)}
                      className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Live Hero Preview */}
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">Live Hero Preview</h3>
                  </div>

                  <div className="relative flex min-h-72 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-900 p-6 text-center">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url("${heroImageUrl.replace(/"/g, '\\"')}")` }}
                    />
                    <div className="absolute inset-0 bg-slate-900/60" />
                    <div className="relative z-10 space-y-2.5">
                      <span className="inline-block rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-xs">
                        {heroBadge || 'Explore Sri Lanka'}
                      </span>
                      <p className="text-xl font-extrabold leading-tight text-white">
                        {heroTitle || DEFAULT_SITE_SETTINGS.hero_title}
                      </p>
                      <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-200">
                        {heroSubtitle || DEFAULT_SITE_SETTINGS.hero_subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
                <p className="text-xs text-slate-500">
                  Last saved: <span className="font-semibold text-slate-700">{formatTimestamp(updatedAt)}</span>
                </p>
                <button
                  type="submit"
                  disabled={!isSuperAdmin || savingHero}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingHero ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingHero ? 'Saving Settings…' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}

          {/* ================= TAB 4: MY ACCOUNT & SECURITY ================= */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Profile Overview Card */}
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-700">
                    {((account?.full_name || account?.email || 'A').trim()[0] || 'A').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-extrabold text-slate-900">
                        {account?.full_name || 'Admin User'}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isSuperAdmin
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                        }`}
                      >
                        {isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}
                      </span>
                    </div>
                    <p className="truncate text-sm text-slate-500">{account?.email}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Verified Active Staff Session
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Update Display Name */}
                <form
                  onSubmit={saveDisplayName}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Update Display Name</h3>
                      <p className="text-xs text-slate-500">
                        Shown in the Admin Portal sidebar, header, and activity logs.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="display_name"
                        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                      >
                        Full Name
                      </label>
                      <input
                        id="display_name"
                        type="text"
                        required
                        minLength={2}
                        maxLength={120}
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="account_email_readonly"
                        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                      >
                        Account Email
                      </label>
                      <input
                        id="account_email_readonly"
                        type="email"
                        disabled
                        value={account?.email ?? ''}
                        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savingProfile ? 'Updating…' : 'Save Display Name'}
                    </button>
                  </div>
                </form>

                {/* Change Password */}
                <form
                  onSubmit={handleChangePassword}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Change Password</h3>
                      <p className="text-xs text-slate-500">
                        Use a strong password of at least 8 characters to protect your admin account.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="new_password"
                        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                      >
                        New Password
                      </label>
                      <input
                        id="new_password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Minimum 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm_password"
                        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="confirm_password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {savingPassword ? 'Updating Password…' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Quick Link Card to /admin/users */}
              <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50/50 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        Staff &amp; Role Management
                      </h3>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        super_admin
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Create admin accounts, manage staff roles, reset access, and audit active portal users.
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/users"
                  className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:self-center"
                >
                  Open Staff Directory
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
