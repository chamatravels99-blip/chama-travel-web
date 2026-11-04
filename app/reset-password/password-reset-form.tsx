'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function PasswordResetForm({ updating }: { updating: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (updating) {
        if (password !== confirmation) throw new Error('Passwords do not match.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw new Error(updateError.message);
        setMessage('Password updated. You can now sign in.');
        await supabase.auth.signOut();
        window.setTimeout(() => router.replace('/login'), 1200);
      } else {
        const callback = new URL('/auth/callback', window.location.origin);
        callback.searchParams.set('next', '/reset-password?mode=update');
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: callback.toString(),
        });
        if (resetError) throw new Error(resetError.message);
        setMessage('If an account exists for that email, a password reset link has been sent.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Password reset could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <section className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Reset password</h1>
          <p className="mt-2 text-sm text-slate-500">{updating ? 'Choose a new password for your account.' : 'We will send a secure reset link if the account exists.'}</p>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" aria-live="polite">{message}</p>}
        <form onSubmit={submit} className="space-y-4">
          {!updating ? (
            <label className="block text-xs font-bold text-slate-700">Email address
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
          ) : (
            <>
              <label className="block text-xs font-bold text-slate-700">New password
                <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
              </label>
              <label className="block text-xs font-bold text-slate-700">Confirm new password
                <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
              </label>
            </>
          )}
          <button disabled={loading} className="w-full rounded-xl bg-blue-600 p-3 text-sm font-bold text-white disabled:opacity-50">
            {loading ? 'Please wait…' : updating ? 'Update password' : 'Send reset link'}
          </button>
        </form>
        <Link href="/login" className="block text-center text-xs font-bold text-blue-700 hover:underline">Return to sign in</Link>
      </section>
    </main>
  );
}
