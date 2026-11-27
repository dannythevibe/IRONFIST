'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Cpu, GitFork, Sliders, Activity, Terminal, Key } from 'lucide-react';
import { useSession } from '@/lib/session';

const navItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'API Keys', href: '/dashboard/keys', icon: Key },
  { name: 'Devices', href: '/dashboard/graph', icon: GitFork },
  { name: 'Verification Log', href: '/dashboard/live-feed', icon: Activity },
  { name: 'Rate Limits', href: '/dashboard/token-bucket', icon: Sliders },
  { name: 'Simulator', href: '/dashboard/simulator', icon: Terminal },
  { name: 'MCP for AI Agents', href: '/dashboard/mcp', icon: Cpu },
];

export default function Sidebar() {
  const pathname = usePathname() || '';
  const { workspace } = useSession();

  return (
    <>
      {/* Mobile: horizontal scroller */}
      <nav className="md:hidden flex gap-2 overflow-x-auto px-4 py-3 border-b border-slate-800/80 text-xs font-semibold">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap px-3 py-2 rounded-xl border ${
              pathname === item.href
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'text-slate-400 border-slate-800'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <aside className="w-64 shrink-0 glass-cyber border-r border-slate-800/80 hidden md:flex flex-col justify-between p-4 min-h-[calc(100vh-4rem)]">
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-semibold text-xs transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/10 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Workspace</div>
          <div className="font-bold text-white truncate">{workspace.name}</div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-900">
            <span>Verify limit</span>
            <span className="text-emerald-400 font-bold">
              {workspace.tb_capacity} burst · {workspace.tb_refill_rate}/s
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
