'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, GitFork, Key, Radio, ShieldAlert, Terminal, Users } from 'lucide-react';
import { api, type Stats } from '@/lib/api';
import { useSession } from '@/lib/session';
import { CodeBlock, ErrorNote, errorMessage } from '@/components/ui';

export default function DashboardOverview() {
  const { workspace } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('https://YOUR-IRONFIST-URL');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    api<Stats>(`/api/workspaces/${workspace.id}/stats`)
      .then((s) => !cancelled && setStats(s))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  const n = (v: number | undefined) => (v === undefined ? '…' : v.toLocaleString());
  const blockRate =
    stats && stats.verifications_total > 0
      ? `${((stats.verifications_blocked / stats.verifications_total) * 100).toFixed(1)}% of all checks`
      : 'No checks yet';

  const cards = [
    {
      label: 'Verifications (24h)',
      value: n(stats?.verifications_24h),
      sub: `${n(stats?.verifications_total)} all time`,
      icon: <Activity className="w-4 h-4 text-cyan-400" />,
    },
    {
      label: 'Blocked (24h)',
      value: n(stats?.verifications_blocked_24h),
      sub: blockRate,
      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
    },
    {
      label: 'Known devices',
      value: n(stats?.devices),
      sub: `${n(stats?.devices_blocked)} blocked by you`,
      icon: <GitFork className="w-4 h-4 text-indigo-400" />,
    },
    {
      label: 'Multi-account devices',
      value: n(stats?.devices_multi_account),
      sub: 'Devices seen with 2+ accounts',
      icon: <Users className="w-4 h-4 text-amber-400" />,
    },
  ];

  const snippet = `curl -X POST ${origin}/v1/verify \\
  -H "Authorization: Bearer if_pk_YOUR_PUBLISHABLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "user_123",
    "hardware_traits": { "os_platform": "windows", "windows_guid": "EXAMPLE-GUID" }
  }'`;

  const links = [
    { href: '/dashboard/keys', label: 'Create or revoke API keys', icon: <Key className="w-4 h-4 text-amber-400" /> },
    { href: '/dashboard/simulator', label: 'Test a verification from this browser', icon: <Terminal className="w-4 h-4 text-cyan-400" /> },
    { href: '/dashboard/graph', label: 'Inspect and block devices', icon: <GitFork className="w-4 h-4 text-indigo-400" /> },
    { href: '/dashboard/live-feed', label: 'Read the verification log', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <div className="space-y-8">
      <div className="glass-cyber p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-1">
          <Radio className="w-3.5 h-3.5" /> Workspace
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">{workspace.name}</h1>
        <p className="text-slate-400 text-xs mt-1 font-mono">{workspace.id}</p>
      </div>

      <ErrorNote message={error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>{c.label}</span>
              {c.icon}
            </div>
            <div className="text-3xl font-black text-white font-mono">{c.value}</div>
            <div className="text-[11px] text-slate-400 font-mono">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-cyber p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-lg text-white">Make your first API call</h3>
          <p className="text-xs text-slate-400">
            Replace the key with a publishable key from the{' '}
            <Link href="/dashboard/keys" className="text-cyan-400 hover:underline">
              API Keys
            </Link>{' '}
            page. In a real app, the SDK collects <code className="text-cyan-300">hardware_traits</code> for you.
          </p>
          <CodeBlock code={snippet} />
          <Link href="/docs" className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline font-mono">
            Full API reference <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-3">
          <h3 className="font-bold text-lg text-white">Next steps</h3>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-all group"
            >
              <span className="flex items-center gap-3">
                {l.icon}
                {l.label}
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
