'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  Cpu,
  Terminal,
  Sparkles,
  LayoutDashboard,
  Copy,
  Check,
  Zap,
  Activity,
} from 'lucide-react';

export default function Navbar() {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const [copied, setCopied] = useState(false);
  const mcpUrl = 'https://mcp.ironfist.dev/v1/sse?key=if_live_9a8b7c6d5e4f3a2b';

  const copyMcp = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-50 glass-cyber border-b border-slate-800/80 bg-cyber-bg/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-600 flex items-center justify-center font-black text-2xl shadow-glow-cyan group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
              👊
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-cyber-bg flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-wider text-white group-hover:text-cyan-400 transition-colors font-mono">
                IRONFIST
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-700/60 font-semibold uppercase tracking-wider">
                v2.0 MCP
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium block tracking-wide">
              Hardware Persistence & Anti-Abuse Protocol
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 text-xs font-mono">
          <Link
            href="/"
            className={`px-4 py-2 rounded-xl transition-all ${
              pathname === '/' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold shadow-sm shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </Link>
          <Link
            href="/dashboard"
            className={`px-4 py-2 rounded-xl transition-all ${
              pathname.startsWith('/dashboard') && pathname !== '/dashboard/simulator'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Console Dashboard
          </Link>
          <Link
            href="/dashboard/simulator"
            className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              pathname === '/dashboard/simulator'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            Live Simulator
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyMcp}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-cyan-400 transition-all"
            title="Copy secured MCP SSE Link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'MCP Link Copied!' : 'Copy MCP SSE'}</span>
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-slate-950 font-bold text-xs shadow-glow-cyan transition-all transform active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4" />
            Launch Console
          </Link>
        </div>
      </div>
    </header>
  );
}
