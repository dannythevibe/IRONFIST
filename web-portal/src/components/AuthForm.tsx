'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CopyButton, ErrorNote, errorMessage } from './ui';

interface SignupResult {
  keys: { publishable: string; secret: string };
}

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<SignupResult['keys'] | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const res = await api<SignupResult>('/api/auth/signup', { body: { email, password } });
        setKeys(res.keys);
      } else {
        await api('/api/auth/login', { body: { email, password } });
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cyber-bg cyber-grid">
      <div className="w-full max-w-md glass-cyber p-8 rounded-3xl border border-slate-800 space-y-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="IronFist" width={40} height={40} className="rounded-lg" />
          <span className="font-extrabold text-xl tracking-wider text-white font-mono">IRONFIST</span>
        </Link>

        {keys ? (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Save your API keys</h1>
              <p className="text-sm text-slate-400 mt-1">
                This is the only time the full keys are shown. You can create new ones later, but these cannot be
                displayed again.
              </p>
            </div>
            {(
              [
                ['Publishable key', 'Goes in your app or website. Can only submit verifications.', keys.publishable],
                ['Secret key', 'Server-side only. Never ship it in client code.', keys.secret],
              ] as const
            ).map(([label, hint, value]) => (
              <div key={label} className="space-y-1.5">
                <div className="text-xs font-mono uppercase text-slate-400">{label}</div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <code className="text-xs font-mono text-cyan-300 break-all flex-1">{value}</code>
                  <CopyButton text={value} />
                </div>
                <p className="text-[11px] text-slate-500">{hint}</p>
              </div>
            ))}
            <button
              onClick={() => router.replace('/dashboard')}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-slate-100 transition-all"
            >
              I have saved them. Open the console
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                {mode === 'signup' ? 'Create your account' : 'Sign in'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {mode === 'signup'
                  ? 'You get a workspace and API keys straight away.'
                  : 'Welcome back to the IronFist console.'}
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-mono uppercase text-slate-400">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-mono uppercase text-slate-400">Password</span>
              <input
                type="password"
                required
                minLength={mode === 'signup' ? 10 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              {mode === 'signup' && <span className="text-[11px] text-slate-500">At least 10 characters.</span>}
            </label>
            <ErrorNote message={error} />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-slate-100 transition-all disabled:opacity-60"
            >
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            <p className="text-xs text-slate-400 text-center">
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <Link href="/login" className="text-cyan-400 hover:underline">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  New to IronFist?{' '}
                  <Link href="/signup" className="text-cyan-400 hover:underline">
                    Create an account
                  </Link>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
