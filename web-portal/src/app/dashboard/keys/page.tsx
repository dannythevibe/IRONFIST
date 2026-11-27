'use client';

import { useCallback, useEffect, useState } from 'react';
import { Key, Plus, Trash2 } from 'lucide-react';
import { api, type ApiKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { CopyButton, ErrorNote, PageHeader, errorMessage } from '@/components/ui';

export default function ApiKeysPage() {
  const { workspace } = useSession();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'publishable' | 'secret'>('publishable');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ key: string; kind: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ keys: ApiKey[] }>(`/api/workspaces/${workspace.id}/keys`);
      setKeys(res.keys);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [workspace.id]);

  useEffect(() => {
    setKeys(null);
    setCreated(null);
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ key: string; kind: string }>(`/api/workspaces/${workspace.id}/keys`, {
        body: { kind, name },
      });
      setCreated(res);
      setName('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k: ApiKey) => {
    if (!window.confirm(`Revoke "${k.name}" (${k.display})? Anything using it will stop working immediately.`)) return;
    try {
      await api(`/api/workspaces/${workspace.id}/keys/${k.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString() : 'Never');

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Access" title="API Keys" icon={<Key className="w-4 h-4" />}>
        Publishable keys (<code className="text-cyan-300">if_pk_</code>) go in your app and can only submit
        verifications. Secret keys (<code className="text-cyan-300">if_sk_</code>) stay on your server and can read and
        change workspace data.
      </PageHeader>

      <ErrorNote message={error} />

      {created && (
        <div className="glass-cyber-glow p-5 rounded-2xl space-y-3">
          <div className="font-bold text-white text-sm">Your new {created.kind} key</div>
          <p className="text-xs text-slate-400">Copy it now. It will not be shown again.</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <code className="text-xs font-mono text-cyan-300 break-all flex-1">{created.key}</code>
            <CopyButton text={created.key} />
          </div>
        </div>
      )}

      <form onSubmit={create} className="glass-cyber p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-mono uppercase text-slate-400 block">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'publishable' | 'secret')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="publishable">Publishable (client)</option>
            <option value="secret">Secret (server)</option>
          </select>
        </label>
        <label className="space-y-1.5 flex-1">
          <span className="text-xs font-mono uppercase text-slate-400 block">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. iOS app, production server"
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-3 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-100 disabled:opacity-60"
        >
          <Plus className="w-4 h-4" /> Create key
        </button>
      </form>

      <div className="glass-cyber rounded-3xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead className="text-slate-400 text-left">
            <tr className="border-b border-slate-800">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Key</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium">Last used</th>
              <th className="p-4 font-medium" />
            </tr>
          </thead>
          <tbody>
            {keys === null ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  No keys yet. Create one above.
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className={`border-b border-slate-900 ${k.revoked_at ? 'opacity-50' : ''}`}>
                  <td className="p-4 text-white font-sans font-semibold">{k.name}</td>
                  <td className="p-4 text-cyan-300">{k.display}</td>
                  <td className="p-4">
                    <span className={k.kind === 'secret' ? 'text-amber-400' : 'text-emerald-400'}>{k.kind}</span>
                  </td>
                  <td className="p-4 text-slate-400">{date(k.created_at)}</td>
                  <td className="p-4 text-slate-400">{date(k.last_used_at)}</td>
                  <td className="p-4 text-right">
                    {k.revoked_at ? (
                      <span className="text-rose-400">Revoked</span>
                    ) : (
                      <button
                        onClick={() => revoke(k)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
