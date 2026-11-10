'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Compass, Users, Car, Bell, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface NavbarProps {
  currentRole: 'Admin' | 'Driver' | 'Customer';
  onRoleChange?: (role: 'Admin' | 'Driver' | 'Customer') => void;
}

export default function Navbar({ currentRole, onRoleChange }: NavbarProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function handleSignOut() {
    setSigningOut(true);
    setLogoutError('');
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        console.error('Sign out failed.', error.code);
        setLogoutError('Sign out could not be completed. Please try again.');
        return;
      }
      window.location.replace('/login');
    } catch (error) {
      console.error('Sign out failed.', error);
      setLogoutError('Sign out could not be completed. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-200/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 flex items-center justify-between gap-3 py-2">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-500/10">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">CHAMA</span>
              <span className="font-bold text-xl text-blue-600">TRAVELS</span>
            </div>
            <p className="text-xs text-slate-400 hidden md:block">Smart Island Transfers & Tour Logistics</p>
          </div>
        </Link>

        {/* 🔒 Role Switcher: ADMIN කෙනෙක් Log වී සිටී නම් පමණක් පෙන්වයි */}
        {currentRole === 'Admin' && onRoleChange && (
          <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
            <button
              onClick={() => onRoleChange('Admin')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-slate-900 text-white shadow-sm"
            >
              <Users className="w-3.5 h-3.5" /> Admin
            </button>
            <button
              onClick={() => onRoleChange('Driver')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <Car className="w-3.5 h-3.5" /> Driver
            </button>
            <button
              onClick={() => onRoleChange('Customer')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <Compass className="w-3.5 h-3.5" /> Customer
            </button>
          </div>
        )}

        {/* Right Icons */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 cursor-pointer">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex flex-col items-end">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              aria-label={signingOut ? 'Signing out' : 'Sign out'}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
            {logoutError && <p role="alert" className="mt-1 text-[10px] text-red-700">{logoutError}</p>}
          </div>
        </div>

      </div>
    </header>
  );
}