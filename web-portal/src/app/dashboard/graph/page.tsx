'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Database, GitFork, Lock, RefreshCw, RotateCcw, ShieldAlert, Unlock } from 'lucide-react';
import { api, type Device } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ErrorNote, PageHeader, errorMessage } from '@/components/ui';

const TRAIT_LABELS: Record<string, string> = {
  os_platform: 'Platform',
  os_version: 'OS version',
  gpu_renderer: 'GPU',
  cpu_cores: 'CPU cores',
  memory_gb: 'Memory (GB)',
  screen_resolution: 'Screen',
  timezone: 'Timezone',
  language: 'Language',
};

export default function DevicesPage() {
  const { workspace } = useSession();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ devices: Device[] }>(`/api/workspaces/${workspace.id}/devices?limit=200`);
      setDevices(res.devices);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    setDevices(null);
    setSelectedId(null);
    load();
  }, [load]);

  const selected = devices?.find((d) => d.id === selectedId) || devices?.[0] || null;

  const act = async (path: string, body: unknown) => {
    try {
      await api(path, { body });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const toggleBlock = (d: Device) => {
    if (d.blocked) {
      act(`/api/workspaces/${workspace.id}/devices/${d.id}/override`, { blocked: false });
      return;
    }
    const reason = window.prompt('Why are you blocking this device? (kept in the audit trail)');
    if (!reason || !reason.trim()) return;
    act(`/api/workspaces/${workspace.id}/devices/${d.id}/override`, { blocked: true, reason });
  };

  const resetTrial = (d: Device) => {
    if (!window.confirm('Clear the trial claim on this device? The next account to verify on it will be allowed.')) return;
    act(`/api/workspaces/${workspace.id}/devices/${d.id}/reset-trial`, {});
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Device graph"
        title="Devices"
        icon={<GitFork className="w-4 h-4" />}
        action={
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono border border-slate-800 flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      >
        Every physical device IronFist has seen in this workspace, and the accounts that used it. Matching threshold:{' '}
        {workspace.match_threshold}.
      </PageHeader>

      <ErrorNote message={error} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-cyber p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-lg text-white font-mono">Devices ({devices?.length ?? 0})</h3>

          {devices === null ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">Loading devices…</div>
          ) : devices.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-3">
              <Database className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-bold">No devices yet</p>
              <p className="text-slate-400 max-w-sm mx-auto text-[11px]">
                Run a check in the{' '}
                <Link href="/dashboard/simulator" className="text-cyan-400 underline">
                  Simulator
                </Link>{' '}
                or call <code className="text-indigo-300">POST /v1/verify</code> to register the first one.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {devices.map((d) => {
                const multi = d.associated_accounts.length > 1;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`p-4 rounded-2xl text-left border transition-all duration-200 ${
                      selected?.id === d.id
                        ? 'bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border-indigo-500 shadow-glow-violet'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="font-mono text-xs font-bold text-white truncate">{d.id}</span>
                      {d.blocked ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1 font-bold shrink-0">
                          <ShieldAlert className="w-3 h-3" /> BLOCKED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-bold shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 space-y-1 font-mono">
                      <div className="truncate">
                        Platform: <span className="text-cyan-400">{d.traits.os_platform || 'unknown'}</span>
                      </div>
                      <div className="truncate">
                        GPU: <span className="text-slate-200">{d.traits.gpu_renderer || 'not reported'}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-900">
                        <span>Linked accounts</span>
                        <span className={`font-bold ${multi ? 'text-amber-400' : 'text-slate-300'}`}>
                          {d.associated_accounts.length}
                          {multi ? ' (multiple)' : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected ? (
          <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-6 self-start">
            <div className="pb-4 border-b border-slate-800 space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Selected device</span>
                <h3 className="font-bold text-sm text-white font-mono break-all">{selected.id}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleBlock(selected)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                    selected.blocked
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {selected.blocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {selected.blocked ? 'Unblock' : 'Block'}
                </button>
                {selected.trial_claimed && (
                  <button
                    onClick={() => resetTrial(selected)}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset trial
                  </button>
                )}
              </div>
              {selected.blocked && selected.block_reason && (
                <p className="text-[11px] text-rose-300 font-mono">Reason: {selected.block_reason}</p>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] font-mono">Trial</div>
              <p className="font-mono text-[11px] text-slate-200">
                {selected.trial_claimed
                  ? `Claimed by ${selected.trial_account_id ?? 'unknown'} on ${new Date(selected.claimed_at ?? selected.updated_at).toLocaleString()}`
                  : 'Not claimed'}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] font-mono">Traits</div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
                {Object.entries(TRAIT_LABELS).map(([field, label]) =>
                  selected.traits[field] === undefined ? null : (
                    <div key={field} className="flex justify-between gap-3">
                      <span className="text-slate-500 shrink-0">{label}</span>
                      <span className="text-slate-200 truncate">{String(selected.traits[field])}</span>
                    </div>
                  ),
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Identifiers</span>
                  <span className="text-purple-300 text-right">
                    {selected.identifier_types.length ? selected.identifier_types.join(', ') : 'fingerprint only'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Identifier values are stored as hashes and cannot be shown.</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] font-mono">
                Accounts ({selected.associated_accounts.length})
              </div>
              {selected.associated_accounts.map((acc) => (
                <div key={acc} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 truncate">
                  {acc}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-cyber p-6 rounded-3xl border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono text-center">
            Select a device to see its traits and accounts.
          </div>
        )}
      </div>
    </div>
  );
}
