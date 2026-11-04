
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Compass, Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const loginEmail = identifier.trim();
      if (!loginEmail || !loginEmail.includes('@')) {
        throw new Error('Enter the email address linked to your account.');
      }

      if (!password) {
        throw new Error('Please enter your password.');
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

      if (authError || !authData.user) {
        throw new Error(
          authError?.message || 'Login failed. Please check your credentials.'
        );
      }

      const { data: roleData, error: roleError } = await supabase.rpc('get_my_roles');
      const roles = Array.isArray(roleData) ? roleData : [];
      if (roleError || roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error(
          'Your account is inactive or does not have an application role. Contact Chama Travels support.'
        );
      }

      if (roles.includes('super_admin') || roles.includes('admin') || roles.includes('operator')) {
        router.replace('/admin/dashboard');
      } else if (roles.includes('driver')) {
        router.replace('/driver/dashboard');
      } else if (roles.includes('customer')) {
        router.replace('/customer/dashboard');
      } else {
        await supabase.auth.signOut();
        throw new Error('Invalid user role. Please contact the administrator.');
      }

      router.refresh();

    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during login.';

      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-slate-200 space-y-6">

        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
            <Compass className="w-6 h-6" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Chama Travels
          </h1>

          <p className="text-xs text-slate-500 font-medium">
          Sign in with Email
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">

          <div>
            <label htmlFor="login-identifier" className="block font-bold text-slate-700 uppercase mb-1">
              Email Address
            </label>

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />

              <input
                type="text"
                id="login-identifier"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-800"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block font-bold text-slate-700 uppercase mb-1">
              Password
            </label>

            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />

              <input
                type="password"
                id="login-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-800"
              />
            </div>
            <div className="mt-2 text-right">
              <Link href="/reset-password" className="font-bold text-blue-600 hover:underline">Forgot password?</Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase tracking-wider rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>

        </form>

        <div className="text-center pt-2 border-t border-slate-100 space-y-1">
          <p className="text-[11px] text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-blue-600 font-bold hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
