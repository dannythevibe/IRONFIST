'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, CheckCircle2, Radio, ShieldAlert } from 'lucide-react';
import { api, type Verification } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ErrorNote, PageHeader, errorMessage } from '@/components/ui';

const REFRESH_MS = 5000;
type Filter = 'ALL' | 'ALLOWED' | 'BLOCKED';

export default function VerificationLogPage() {
  const { workspace } = useSession();
  const [logs, setLogs] = useState<Verification[] | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ verifications: Verification[] }>(`/api/workspaces/${workspace.id}/logs?limit=100`);
      setLogs(res.verifications);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [workspace.id]);

  useEffect(() => {
    setLogs(null);
    load();
    // Poll only while the tab is visible.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const shown = (logs ?? []).filter((l) => filter === 'ALL' || (filter === 'ALLOWED' ? l.allowed : !l.allowed));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Audit trail"
        title="Verification Log"
        icon={<Radio className="w-4 h-4" />}
        action={
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono self-start sm:self-auto">
            {(['ALL', 'ALLOWED', 'BLOCKED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  filter === f ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold' : 'text-slate-400'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'ALLOWED' ? 'Allowed' : 'Blocked'}
              </button>
            ))}
          </div>
        }
      >
        The latest 100 decisions, refreshed every 5 seconds. Entries are kept for 30 days.
      </PageHeader>

      <ErrorNote message={error} />

      <div className="space-y-4">
        {logs === null ? (
          <div className="glass-cyber p-12 text-center text-slate-500 font-mono text-xs rounded-3xl">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="glass-cyber p-12 text-center text-slate-500 font-mono text-xs space-y-3 rounded-3xl">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-bold">No verifications yet</p>
            <p className="text-slate-400 text-[11px]">
              Run one from the{' '}
              <Link href="/dashboard/simulator" className="text-cyan-400 underline">
                Simulator
              </Link>
              .
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="glass-cyber p-8 text-center text-slate-500 font-mono text-xs rounded-3xl">
            Nothing matches this filter.
          </div>
        ) : (
          shown.map((log) => (
            <div
              key={log.id}
              className={`p-5 rounded-3xl glass-cyber border ${
                log.allowed ? 'border-slate-800' : 'border-rose-900/40 bg-rose-950/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-900">
                <div className="flex items-center gap-3 min-w-0">
                  {log.allowed ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ALLOWED
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-xs font-mono font-bold flex items-center gap-1.5 shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5" /> {log.decision}
                    </span>
                  )}
                  <span className="text-xs font-mono text-cyan-300 font-bold truncate">{log.account_id}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 shrink-0">
                  {new Date(log.timestamp).toLocaleString()} · {log.source}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Network</span>
                  <span className="text-slate-200">{log.client_ip || 'server-side call'}</span>
                  {log.ip_check?.available && (
                    <span className="block text-[11px] text-slate-400 truncate">
                      {log.ip_check.org}
                      {log.ip_check.country ? ` · ${log.ip_check.country}` : ''}
                      {log.ip_check.is_tor ? ' · Tor' : log.ip_check.is_vpn ? ' · VPN' : log.ip_check.is_datacenter ? ' · datacenter' : ''}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Device</span>
                  <span className="text-indigo-400 truncate block font-bold">{log.device_id || 'none'}</span>
                  {log.device_id && (
                    <span className="block text-[11px] text-slate-400">
                      {log.deterministic ? 'Exact identifier match' : `Similarity ${log.similarity_score.toFixed(2)}`}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Reason</span>
                  <span className="text-slate-300 block text-[11px] leading-tight">{log.reason}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
