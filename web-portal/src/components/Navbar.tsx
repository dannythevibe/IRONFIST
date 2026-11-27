'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, LogOut } from 'lucide-react';
import { useSession } from '@/lib/session';

export default function Navbar() {
  const { user, workspaces, workspace, selectWorkspace, logout } = useSession();

  return (
    <header className="sticky top-0 z-50 glass-cyber border-b border-slate-800/80 bg-cyber-bg/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/logo.jpg" alt="IronFist" width={36} height={36} className="rounded-lg" />
          <div>
            <span className="font-extrabold text-lg tracking-wider text-white group-hover:text-cyan-400 transition-colors font-mono block leading-tight">
              IRONFIST
            </span>
            <span className="text-[10px] text-slate-400 font-medium block tracking-wide">Console</span>
          </div>
        </Link>

        <div className="flex items-center gap-3 text-xs font-mono">
          {workspaces.length > 1 && (
            <select
              value={workspace.id}
              onChange={(e) => selectWorkspace(e.target.value)}
              aria-label="Workspace"
              className="hidden sm:block px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          <Link
            href="/docs"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            Docs
          </Link>
          <span className="hidden md:inline text-slate-400 truncate max-w-[200px]">{user.email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
