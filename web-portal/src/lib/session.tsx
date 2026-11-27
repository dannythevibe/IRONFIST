'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Workspace } from './api';

interface SessionValue {
  user: { id: string; email: string };
  workspaces: Workspace[];
  workspace: Workspace;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);
const WORKSPACE_KEY = 'ironfist_workspace';

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside the dashboard');
  return value;
}

/** Loads the signed-in user, or sends the visitor to the login page. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionValue['user'] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: SessionValue['user']; workspaces: Workspace[] }>('/api/me');
      setUser(me.user);
      setWorkspaces(me.workspaces);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not load your account');
    }
  }, [router]);

  useEffect(() => {
    try {
      setSelectedId(window.localStorage.getItem(WORKSPACE_KEY));
    } catch {
      /* storage blocked */
    }
    refresh();
  }, [refresh]);

  const selectWorkspace = useCallback((id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(WORKSPACE_KEY, id);
    } catch {
      /* storage blocked */
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-cyber p-6 rounded-3xl border border-rose-800/40 text-sm text-rose-300 max-w-md space-y-3">
          <p className="font-bold">Could not load the console</p>
          <p className="text-xs text-slate-400">{error}</p>
          <button onClick={refresh} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const workspace = workspaces.find((w) => w.id === selectedId) || workspaces[0];
  if (!user || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-xs font-mono">
        Loading console…
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ user, workspaces, workspace, selectWorkspace, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
