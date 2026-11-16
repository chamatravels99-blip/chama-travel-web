'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Car,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Compass,
  CreditCard,
  Home,
  Image,
  LogOut,
  Map,
  MapPin,
  Menu,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { AppRole } from '@/lib/server/authorization';

type AdminShellProps = {
  children: React.ReactNode;
  email: string;
  displayName: string;
  roles: AppRole[];
};

type NavigationItem = {
  label: string;
  href?: string;
  icon: typeof Home;
  roles: AppRole[];
  comingSoon?: boolean;
};

const ADMIN_ROLES: AppRole[] = ['admin', 'super_admin'];
const OPERATIONS_ROLES: AppRole[] = ['admin', 'super_admin'];

const navigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: Home, roles: OPERATIONS_ROLES },
  { label: 'Bookings', href: '/admin/bookings', icon: Clipboard, roles: OPERATIONS_ROLES },
  { label: 'Destinations', href: '/admin/destinations', icon: MapPin, roles: ADMIN_ROLES },
  { label: 'Fleet', href: '/admin/fleet', icon: Car, roles: ADMIN_ROLES },
  { label: 'Tour Packages', href: '/admin/tour-packages', icon: Map, roles: ADMIN_ROLES },
  { label: 'Gallery & Activities', icon: Image, roles: ADMIN_ROLES, comingSoon: true },
  { label: 'Analytics', icon: BarChart3, roles: ADMIN_ROLES, comingSoon: true },
  { label: 'Customers', icon: Users, roles: ADMIN_ROLES, comingSoon: true },
  { label: 'Marketing', icon: Megaphone, roles: ADMIN_ROLES, comingSoon: true },
  { label: 'Users', href: '/admin/users', icon: ShieldCheck, roles: ADMIN_ROLES },
  { label: 'Settings', icon: Settings, roles: ADMIN_ROLES, comingSoon: true },
  { label: 'Pricing', href: '/admin/pricing', icon: CreditCard, roles: ADMIN_ROLES },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard, roles: ADMIN_ROLES },
];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
};

export default function AdminShell({ children, email, displayName, roles }: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const allowedNavigation = navigation.filter((item) =>
    item.roles.some((role) => roles.includes(role))
  );

  async function logout() {
    setSigningOut(true);
    setLogoutError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Admin sign out failed.', error.code);
        setLogoutError('Sign out could not be completed. Please try again.');
        return;
      }
      window.location.replace('/login');
    } catch (error) {
      console.error('Admin sign out failed.', error);
      setLogoutError('Sign out could not be completed. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  function sidebarContent(isMobile = false) {
    return (
      <>
        <div className={`flex h-16 items-center ${collapsed && !isMobile ? 'justify-center px-2' : 'gap-3 px-5'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-emerald-500 text-white shadow-md">
            <Compass className="h-6 w-6" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-wide text-slate-900">CHAMA TRAVELS</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Admin portal</p>
            </div>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {allowedNavigation.map(({ label, href, icon: Icon, comingSoon }) => {
            const active = Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));
            const classes = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
              active
                ? 'bg-blue-50 text-blue-700'
                : comingSoon
                  ? 'cursor-not-allowed text-slate-400'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`;
            const content = (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                {(!collapsed || isMobile) && <span className="min-w-0 flex-1 truncate">{label}</span>}
                {(!collapsed || isMobile) && comingSoon && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Soon</span>
                )}
              </>
            );
            if (!href || comingSoon) {
              return (
                <div key={label} aria-disabled="true" title={`${label} will be available in a later phase`} className={classes}>
                  {content}
                </div>
              );
            }
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? 'page' : undefined}
                title={collapsed && !isMobile ? label : undefined}
                onClick={() => setMobileOpen(false)}
                className={classes}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-slate-200 p-3 ${collapsed && !isMobile ? 'flex justify-center' : ''}`}>
          {(!collapsed || isMobile) && (
            <div className="mb-3 min-w-0 px-2">
              <p className="truncate text-sm font-bold text-slate-800">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {roles.map((role) => (
                  <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {ROLE_LABELS[role]}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            disabled={signingOut}
            title={collapsed && !isMobile ? 'Sign out' : undefined}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {(!collapsed || isMobile) && (signingOut ? 'Signing out…' : 'Sign out')}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] lg:flex ${collapsed ? 'w-20' : 'w-64'}`}>
        {sidebarContent()}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900 lg:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/50"
          />
          <aside className="relative flex h-full w-[min(20rem,85vw)] flex-col bg-white shadow-2xl">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:justify-end">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-3 lg:flex">
            <div className="text-right">
              <p className="max-w-64 truncate text-sm font-bold text-slate-800">{displayName}</p>
              <p className="text-xs text-slate-500">{roles.map((role) => ROLE_LABELS[role]).join(' · ')}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700">
              {(displayName.trim()[0] || 'A').toUpperCase()}
            </div>
          </div>
          <span className="text-xs font-bold text-slate-700 lg:hidden">CHAMA TRAVELS</span>
        </header>
        {logoutError && (
          <p role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
            {logoutError}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
