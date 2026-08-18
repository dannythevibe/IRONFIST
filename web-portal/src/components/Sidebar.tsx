'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Cpu,
  GitFork,
  Sliders,
  Activity,
  Terminal,
  ShieldCheck,
  Zap,
  Key,
  Radio,
} from 'lucide-react';

export default function Sidebar() {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';

  const navItems = [
    { name: 'Console Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'MCP Generator', href: '/dashboard/mcp', icon: Cpu, badge: 'SSE v2' },
    { name: 'Fuzzy Device Graph', href: '/dashboard/graph', icon: GitFork, badge: 'S ≥ 0.88' },
    { name: 'Token Bucket Limiter', href: '/dashboard/token-bucket', icon: Sliders },
    { name: 'Live Verification Feed', href: '/dashboard/live-feed', icon: Activity, pulse: true },
    { name: 'Interactive Simulator', href: '/dashboard/simulator', icon: Terminal, highlight: true },
  ];

  return (
    <aside className="w-64 glass-cyber border-r border-slate-800/80 hidden md:flex flex-col justify-between p-4 min-h-[calc(100vh-5rem)]">
      <div className="space-y-6">
        <div>
          <div className="px-3 mb-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold flex items-center justify-between">
            <span>Navigation Engine</span>
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/10 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="font-sans font-semibold">{item.name}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Active Workspace Info */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1.5">
            <Key className="w-3 h-3 text-amber-400" />
            <span>Workspace Profile</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white font-sans">Production App</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-[10px] font-mono text-cyan-400 truncate bg-slate-900 px-2 py-1 rounded border border-slate-800">
              if_live_9a8b7c6d5e4f3a2b
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-900">
              <span>Token Limit:</span>
              <span className="text-emerald-400 font-bold">100 req/s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gateway Telemetry Footer */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-indigo-500/30 text-xs space-y-1">
        <div className="flex items-center justify-between text-indigo-300 font-bold">
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Go Edge Gateway
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">0.74ms</span>
        </div>
        <p className="text-[10px] text-slate-400 font-sans leading-tight">
          Sub-1ms atomic Redis Lua rate limiting active.
        </p>
      </div>
    </aside>
  );
}
