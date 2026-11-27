'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Save, ShieldAlert, Sliders } from 'lucide-react';
import { api, type BucketResult } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ErrorNote, PageHeader, errorMessage } from '@/components/ui';

export default function RateLimitsPage() {
  const { workspace, refresh } = useSession();
  const [capacity, setCapacity] = useState(workspace.tb_capacity);
  const [refillRate, setRefillRate] = useState(workspace.tb_refill_rate);
  const [threshold, setThreshold] = useState(workspace.match_threshold);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BucketResult | null>(null);

  useEffect(() => {
    setCapacity(workspace.tb_capacity);
    setRefillRate(workspace.tb_refill_rate);
    setThreshold(workspace.match_threshold);
    setResult(null);
  }, [workspace.id, workspace.tb_capacity, workspace.tb_refill_rate, workspace.match_threshold]);

  const dirty =
    capacity !== workspace.tb_capacity ||
    refillRate !== workspace.tb_refill_rate ||
    threshold !== workspace.match_threshold;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        body: { tb_capacity: capacity, tb_refill_rate: refillRate, match_threshold: threshold },
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const test = async (body: { requested?: number; reset?: boolean }) => {
    setError(null);
    try {
      setResult(await api<BucketResult>(`/api/workspaces/${workspace.id}/token-bucket/test`, { body }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remaining = result ? result.remaining : workspace.tb_capacity;
  const fill = Math.min(100, Math.max(0, (remaining / workspace.tb_capacity) * 100));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Workspace settings" title="Rate Limits and Matching" icon={<Sliders className="w-4 h-4" />}>
        The token bucket caps how fast this workspace can call <code className="text-cyan-300">/v1/verify</code>. It
        allows bursts up to the capacity, then refills continuously.
      </PageHeader>

      <ErrorNote message={error} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-cyber p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-medium">Burst capacity</span>
              <span className="font-mono text-cyan-400 font-bold">{capacity} requests</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-xs text-slate-500">How many verifications can arrive at once before requests get a 429.</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-medium">Refill rate</span>
              <span className="font-mono text-emerald-400 font-bold">{refillRate} per second</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={refillRate}
              onChange={(e) => setRefillRate(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <p className="text-xs text-slate-500">The sustained request rate once the burst is used up.</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-medium">Fingerprint match threshold</span>
              <span className="font-mono text-indigo-400 font-bold">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
            <p className="text-xs text-slate-500">
              How alike two browser fingerprints must be to count as one device when no hardware identifier matches.
              Lower catches more repeat users but risks merging different people with identical hardware. 0.88 is the
              default.
            </p>
          </div>

          <button
            onClick={save}
            disabled={!dirty || saving}
            className="px-5 py-3 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-2 hover:bg-slate-100 disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
          </button>
        </div>

        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center space-y-5">
          <div>
            <h3 className="font-bold text-base text-white">Try it</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              A scratch bucket with your saved limits. It does not affect real traffic.
            </p>
          </div>

          <div className="w-32 h-52 rounded-3xl border-2 border-slate-700 bg-slate-950 relative overflow-hidden flex flex-col justify-end p-2">
            <div
              className="w-full bg-gradient-to-t from-cyan-600 via-indigo-500 to-emerald-400 rounded-2xl transition-all duration-300"
              style={{ height: `${fill}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-xl text-white drop-shadow-md">
              {Math.floor(remaining)} / {workspace.tb_capacity}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {[1, 10, 50].map((nTokens) => (
              <button
                key={nTokens}
                onClick={() => test({ requested: nTokens })}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700"
              >
                Take {nTokens}
              </button>
            ))}
            <button
              onClick={() => test({ reset: true })}
              className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-mono border border-cyan-500/40 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refill
            </button>
          </div>

          {result && (
            <div
              className={`w-full p-3 rounded-xl border text-xs font-mono ${
                result.allowed
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                  : 'bg-red-950/40 border-red-800 text-red-400'
              }`}
            >
              <div className="font-bold flex items-center justify-center gap-1.5">
                {result.allowed ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                {result.allowed ? 'Allowed' : 'Rate limited (429)'}
              </div>
              {!result.allowed && result.retry_after !== null && (
                <div className="mt-1 text-[11px]">Retry in {result.retry_after}s</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
