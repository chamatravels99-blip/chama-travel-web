'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, Users, Car, Bell } from 'lucide-react';

interface NavbarProps {
  currentRole: 'Admin' | 'Driver' | 'Customer';
  onRoleChange?: (role: 'Admin' | 'Driver' | 'Customer') => void;
}

export default function Navbar({ currentRole, onRoleChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-200/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
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
        </div>

      </div>
    </header>
  );
}