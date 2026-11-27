'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eraser, Laptop, Play, Shuffle, Terminal } from 'lucide-react';
import { collectBrowserTraits } from '../../../../../sdks/js-client/index';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ErrorNote, PageHeader, errorMessage } from '@/components/ui';

export default function SimulatorPage() {
  const { workspace, user } = useSession();
  const [accountId, setAccountId] = useState(user.email);
  const [traitsText, setTraitsText] = useState('{}');
  const [requireNoVpn, setRequireNoVpn] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const collect = useCallback(async () => {
    setCollecting(true);
    setError(null);
    try {
      setTraitsText(JSON.stringify(await collectBrowserTraits(), null, 2));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCollecting(false);
    }
  }, []);

  useEffect(() => {
    collect();
  }, [collect]);

  const editTraits = (change: (t: Record<string, unknown>) => void) => {
    try {
      const t = JSON.parse(traitsText);
      change(t);
      setTraitsText(JSON.stringify(t, null, 2));
      setError(null);
    } catch {
      setError('The traits box does not contain valid JSON.');
    }
  };

  const hex = (len: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) => b.toString(16).padStart(2, '0')).join('');

  const run = async () => {
    let traits: unknown;
    try {
      traits = JSON.parse(traitsText);
    } catch {
      setError('The traits box does not contain valid JSON.');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      setResponse(
        await api(`/api/workspaces/${workspace.id}/simulate`, {
          body: { account_id: accountId, hardware_traits: traits, require_no_vpn: requireNoVpn },
        }),
      );
    } catch (err) {
      setResponse(null);
      setError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  const tool =
    'px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-mono flex items-center gap-2';

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Test bench" title="Simulator" icon={<Terminal className="w-4 h-4" />}>
        Runs real verifications in this workspace using the fingerprint of the browser you are in. Results are written
        to your device graph and log, exactly as an API call would.
      </PageHeader>

      <ErrorNote message={error} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-5">
          <label className="block space-y-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Account ID</span>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[11px] text-slate-500 block">
              Run once, then change this and run again: the second account is refused the trial on the same device.
            </span>
          </label>

          <div className="space-y-2">
            <span className="text-xs font-mono text-slate-400 uppercase block">Hardware traits (editable JSON)</span>
            <textarea
              value={traitsText}
              onChange={(e) => setTraitsText(e.target.value)}
              spellCheck={false}
              rows={14}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={collect} disabled={collecting} className={tool}>
                <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                {collecting ? 'Reading…' : 'Use this browser'}
              </button>
              <button
                onClick={() => editTraits((t) => delete t.storage_id)}
                className={tool}
                title="Removes the stored token, as if the user cleared site data. The fingerprint should still match."
              >
                <Eraser className="w-3.5 h-3.5 text-amber-400" /> Simulate storage wipe
              </button>
              <button
                onClick={() =>
                  editTraits((t) => {
                    t.storage_id = hex(32);
                    t.canvas_hash = hex(64);
                    t.webgl_hash = hex(64);
                  })
                }
                className={tool}
                title="Replaces the token and fingerprints, as a different machine would send."
              >
                <Shuffle className="w-3.5 h-3.5 text-indigo-400" /> Pretend to be another device
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={requireNoVpn}
              onChange={(e) => setRequireNoVpn(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700"
            />
            <span className="text-slate-300 font-medium">
              Refuse VPN, proxy, datacenter and Tor connections (checks the network you are on right now)
            </span>
          </label>

          <button
            onClick={run}
            disabled={running}
            className="w-full py-3.5 rounded-2xl bg-white text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 disabled:opacity-60"
          >
            <Play className="w-4 h-4 fill-current" />
            {running ? 'Verifying…' : 'Run verification'}
          </button>
        </div>

        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white font-mono">Response</h3>
            {response && (
              <span
                className={`text-xs font-mono px-3 py-1 rounded-full font-bold ${
                  response.allowed
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {response.decision}
              </span>
            )}
          </div>
          <div className="flex-1 bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-cyan-300 overflow-auto max-h-[560px] min-h-[200px]">
            {response ? (
              <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(response, null, 2)}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-center p-6">
                Run a verification to see the decision.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
