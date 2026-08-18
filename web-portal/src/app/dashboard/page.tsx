'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  GitFork,
  Sliders,
  Terminal,
  Cpu,
  Copy,
  Check,
  Zap,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Radio,
  Lock,
} from 'lucide-react';

export default function DashboardOverview() {
  const [copied, setCopied] = useState(false);
  const mcpLink = 'https://mcp.ironfist.dev/v1/sse?key=if_live_9a8b7c6d5e4f3a2b';

  const copyLink = () => {
    navigator.clipboard.writeText(mcpLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-cyber p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-1">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Live Telemetry Feed
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Console Overview
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
              Gateway Online
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Monitoring active workspace <strong className="text-white font-mono">Production Workspace</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/simulator"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono text-xs border border-slate-800 flex items-center gap-2 transition-all"
          >
            <Terminal className="w-4 h-4 text-amber-400" />
            Simulator
          </Link>
          <Link
            href="/dashboard/mcp"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-glow-cyan transition-all"
          >
            <Cpu className="w-4 h-4" />
            MCP SSE Link
          </Link>
        </div>
      </div>

      {/* 4 Metric Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Total Verification Checks</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">142,850</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono font-semibold">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% from last 24h
          </div>
        </div>

        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Blocked Abuse Attempts</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-black text-white font-mono">18,420</div>
          <div className="text-[11px] text-slate-400 font-mono">
            Block Rate: <span className="text-rose-400 font-bold">12.9%</span>
          </div>
        </div>

        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Device Graph Nodes</span>
            <GitFork className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">34,120</div>
          <div className="text-[11px] text-indigo-400 font-mono font-semibold">
            Similarity Score S ≥ 0.88
          </div>
        </div>

        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Gateway Latency</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">0.74ms</div>
          <div className="text-[11px] text-emerald-400 font-mono font-semibold">
            Sub-1ms Redis Lua Atomic
          </div>
        </div>
      </div>

      {/* Main Grid: MCP Provisioning + Navigation Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick MCP Provisioning Banner */}
        <div className="lg:col-span-2 glass-cyber-glow p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Model Context Protocol (MCP) SSE Server</h3>
                <p className="text-xs text-slate-400">Exposes native ironfist_verify_device tools to Cursor, Trae, & Claude Code</p>
              </div>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-700/60 font-bold">
              SSE Protocol
            </span>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping ml-1" />
            <code className="text-xs font-mono text-cyan-300 truncate flex-1">{mcpLink}</code>
            <button
              onClick={copyLink}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-glow-cyan"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono pt-2">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">TOOL 1</span>
              <span className="text-cyan-400 font-bold">ironfist_verify_device</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">TOOL 2</span>
              <span className="text-indigo-400 font-bold">ironfist_check_token_bucket</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">TOOL 3</span>
              <span className="text-purple-400 font-bold">ironfist_override_user</span>
            </div>
          </div>
        </div>

        {/* Console Action Launcher */}
        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-lg text-white">Control Panel Navigation</h3>
          <div className="space-y-3">
            <Link
              href="/dashboard/graph"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-3">
                <GitFork className="w-4 h-4 text-indigo-400" />
                <span className="font-sans font-semibold text-slate-200">Inspect Fuzzy Device Graph</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </Link>

            <Link
              href="/dashboard/token-bucket"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="font-sans font-semibold text-slate-200">Tune Token Bucket Limits</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </Link>

            <Link
              href="/dashboard/live-feed"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="font-sans font-semibold text-slate-200">Stream Live Verification Log</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </Link>

            <Link
              href="/dashboard/simulator"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-medium transition-all group"
            >
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="font-sans font-semibold text-slate-200">Run Interactive Simulator</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
