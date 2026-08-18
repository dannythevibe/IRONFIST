'use client';

import { useState, useEffect } from 'react';
import { Activity, ShieldAlert, CheckCircle2, RefreshCw, Radio, Terminal } from 'lucide-react';

interface VerificationLog {
  id: string;
  timestamp: string;
  account_id: string;
  client_ip: string;
  ip_risk?: {
    is_vpn: boolean;
    is_datacenter: boolean;
    org: string;
    asn: string;
  };
  node_id: string;
  match_score: number;
  deterministic: boolean;
  decision: string;
  reason: string;
  remaining_tokens: number;
}

export default function LiveFeedPage() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveFeed = async () => {
    try {
      const res = await fetch('http://localhost:8080/v1/live-feed');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      } else {
        setError('Gateway returned error status');
      }
    } catch (err: any) {
      setError(`Cannot connect to Go Gateway on http://localhost:8080 (${err.message})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveFeed();
    const interval = setInterval(fetchLiveFeed, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'ALLOWED') return item.decision === 'ALLOWED';
    if (filter === 'BLOCKED') return item.decision !== 'ALLOWED';
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-1">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" /> Real Audit Stream
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Real-Time Verification Log Feed</h1>
          <p className="text-slate-400 text-xs mt-1">
            Real audit trail of incoming <code className="text-cyan-400 font-mono">POST /v1/verify-trial</code> decisions and sub-1ms IP risk inspections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                filter === 'ALL' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold' : 'text-slate-400'
              }`}
            >
              All Logs
            </button>
            <button
              onClick={() => setFilter('ALLOWED')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                filter === 'ALLOWED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' : 'text-slate-400'
              }`}
            >
              Allowed
            </button>
            <button
              onClick={() => setFilter('BLOCKED')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                filter === 'BLOCKED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold' : 'text-slate-400'
              }`}
            >
              Blocked
            </button>
          </div>

          <button
            onClick={fetchLiveFeed}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass-cyber p-12 text-center text-slate-500 font-mono text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto" />
            <p>Streaming audit verification logs from Go Gateway...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="glass-cyber p-12 text-center text-slate-500 font-mono text-xs space-y-3">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-bold">No Audit Verification Logs Yet</p>
            <p className="text-slate-400 max-w-sm mx-auto text-[11px]">
              Execute a verification request in the <a href="/dashboard/simulator" className="text-cyan-400 underline">Simulator</a> to generate real audit logs!
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isAllowed = log.decision === 'ALLOWED';

            return (
              <div
                key={log.id}
                className={`p-5 rounded-3xl glass-cyber border transition-all ${
                  isAllowed ? 'border-slate-800 hover:border-slate-700' : 'border-rose-900/40 bg-rose-950/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-900">
                  <div className="flex items-center gap-3">
                    {isAllowed ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ALLOWED
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-xs font-mono font-bold flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" /> {log.decision}
                      </span>
                    )}

                    <span className="text-xs font-mono text-cyan-300 font-bold">{log.account_id}</span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">CLIENT IP / RISK</span>
                    <span className="text-slate-200">{log.client_ip}</span>
                    {log.ip_risk && (
                      <span className="block text-[11px] text-slate-400 truncate">{log.ip_risk.org}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">DEVICE NODE ID</span>
                    <span className="text-indigo-400 truncate block font-bold">{log.node_id || 'unlinked'}</span>
                    <span className="block text-[11px] text-slate-400">
                      Similarity S={log.match_score.toFixed(2)} {log.deterministic && '(Deterministic)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">VERIFICATION REASON</span>
                    <span className="text-slate-300 block text-[11px] leading-tight">{log.reason}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
