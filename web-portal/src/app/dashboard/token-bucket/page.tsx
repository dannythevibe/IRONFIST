'use client';

import { useState } from 'react';
import { Sliders, Zap, RefreshCw, ShieldAlert, CheckCircle2, Play } from 'lucide-react';

export default function TokenBucketPage() {
  const [capacity, setCapacity] = useState(100);
  const [refillRate, setRefillRate] = useState(5);
  const [currentTokens, setCurrentTokens] = useState(100);
  const [lastCheckResult, setLastCheckResult] = useState<any>(null);

  const consumeTokens = async (requested: number) => {
    try {
      const res = await fetch('http://localhost:8080/v1/token-bucket/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'if_live_9a8b7c6d5e4f3a2b',
          capacity,
          refill_rate: refillRate,
          requested,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastCheckResult(data);
        setCurrentTokens(data.remaining);
        return;
      }
    } catch {}

    // Fallback UI simulation if gateway offline
    if (currentTokens >= requested) {
      const remaining = currentTokens - requested;
      setCurrentTokens(remaining);
      setLastCheckResult({
        allowed: true,
        remaining,
        capacity,
        refill_rate: refillRate,
      });
    } else {
      setLastCheckResult({
        allowed: false,
        remaining: currentTokens,
        capacity,
        refill_rate: refillRate,
      });
    }
  };

  const refillBucket = () => {
    setCurrentTokens(capacity);
    setLastCheckResult(null);
  };

  const fillPercentage = Math.min(100, Math.max(0, (currentTokens / capacity) * 100));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider mb-1">
          <Sliders className="w-4 h-4" /> Atomic Rate Limiter
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Token Bucket Configuration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Redis 7+ atomic Lua script rate limiter prevents fixed-window spikes by continuously refilling token buckets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sliders and Parameter Controls */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h3 className="font-bold text-lg text-white">Rate Limits Parameters</h3>

          {/* Capacity Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-medium">Max Token Capacity</span>
              <span className="font-mono text-cyan-400 font-bold">{capacity} Tokens</span>
            </div>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={capacity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCapacity(val);
                if (currentTokens > val) setCurrentTokens(val);
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-xs text-slate-500">Maximum request burst volume allowed for client IP or device key.</p>
          </div>

          {/* Refill Rate Slider */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-medium">Refill Speed (Tokens / sec)</span>
              <span className="font-mono text-emerald-400 font-bold">{refillRate} tokens/s</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={refillRate}
              onChange={(e) => setRefillRate(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <p className="text-xs text-slate-500">Rate at which tokens automatically replenish into the bucket per second.</p>
          </div>

          {/* Simulation Action Buttons */}
          <div className="pt-6 border-t border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Burst Traffic</div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => consumeTokens(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-all"
              >
                Consume 1 Token
              </button>
              <button
                onClick={() => consumeTokens(10)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-all"
              >
                Consume 10 Tokens
              </button>
              <button
                onClick={() => consumeTokens(50)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-all"
              >
                Consume 50 Tokens
              </button>
              <button
                onClick={refillBucket}
                className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-mono border border-cyan-500/40 flex items-center gap-1.5 transition-all ml-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refill Bucket
              </button>
            </div>
          </div>
        </div>

        {/* Visual Token Bucket Glass Cylinder */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between items-center text-center space-y-6">
          <h3 className="font-bold text-base text-white">Live Bucket Fill Level</h3>

          {/* Visual Cylinder */}
          <div className="w-36 h-64 rounded-3xl border-2 border-slate-700 bg-slate-950 relative overflow-hidden flex flex-col justify-end p-2 shadow-2xl">
            {/* Fluid fill element */}
            <div
              className="w-full bg-gradient-to-t from-cyan-600 via-indigo-500 to-emerald-400 rounded-2xl transition-all duration-300 relative"
              style={{ height: `${fillPercentage}%` }}
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-white/40 animate-pulse rounded-t-full" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-2xl text-white drop-shadow-md">
              {currentTokens.toFixed(0)} / {capacity}
            </div>
          </div>

          {/* Execution Result badge */}
          {lastCheckResult && (
            <div
              className={`w-full p-3 rounded-xl border text-xs font-mono transition-all ${
                lastCheckResult.allowed
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                  : 'bg-red-950/40 border-red-800 text-red-400'
              }`}
            >
              <div className="font-bold flex items-center justify-center gap-1.5">
                {lastCheckResult.allowed ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                {lastCheckResult.allowed ? 'REQUEST ALLOWED' : 'RATE LIMITED (429)'}
              </div>
              <div className="mt-1 text-[11px]">
                Tokens remaining: {lastCheckResult.remaining.toFixed(1)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
