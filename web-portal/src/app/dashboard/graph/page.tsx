'use client';

import { useState, useEffect } from 'react';
import { GitFork, ShieldAlert, CheckCircle2, RefreshCw, Cpu, Monitor, Smartphone, Lock, Unlock, Database } from 'lucide-react';

interface GraphNodeItem {
  id: string;
  primary_hash: string;
  traits: {
    keychain_id?: string;
    widevine_drm_id?: string;
    windows_guid?: string;
    io_platform_uuid?: string;
    os_platform: string;
    gpu_renderer: string;
    screen_resolution: string;
    cpu_cores: number;
  };
  associated_accounts: string[];
  trial_claimed: boolean;
  blocked: boolean;
  block_reason?: string;
}

export default function DeviceGraphPage() {
  const [nodes, setNodes] = useState<GraphNodeItem[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8080/v1/graph');
      if (res.ok) {
        const data = await res.json();
        if (data.nodes) {
          setNodes(data.nodes);
          if (data.nodes.length > 0 && !selectedNode) {
            setSelectedNode(data.nodes[0]);
          }
        }
      } else {
        setError('Gateway returned HTTP error status');
      }
    } catch (err: any) {
      setError(`Cannot connect to Go Gateway on http://localhost:8080 (${err.message})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const toggleBlockNode = async (nodeId: string, currentBlocked: boolean) => {
    const newBlocked = !currentBlocked;
    const reason = newBlocked ? 'Blocked via Console' : 'Unblocked via Console';

    try {
      await fetch('http://localhost:8080/v1/override-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId, blocked: newBlocked, reason }),
      });
    } catch {}

    fetchNodes();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs uppercase tracking-widest mb-1">
            <GitFork className="w-4 h-4" /> Graph Similarity Engine
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Fuzzy Device Relationship Graph</h1>
          <p className="text-slate-400 text-xs mt-1">
            Real device matching algorithm ($S \ge 0.88$) links accounts registered on identical physical hardware despite storage wipes.
          </p>
        </div>

        <button
          onClick={fetchNodes}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono border border-slate-800 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh Graph State
        </button>
      </div>

      {/* Main Split View: Visual Canvas Nodes + Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Graph Visual Representation */}
        <div className="lg:col-span-2 glass-cyber p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white font-mono">Physical Device Nodes ({nodes.length})</h3>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-bold">
              Threshold S ≥ 0.88
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto" />
              <p>Querying Go Edge Gateway persistent graph store...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs font-mono space-y-2">
              <div className="font-bold text-sm">Connection Warning</div>
              <p>{error}</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-3">
              <Database className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-bold">No Physical Hardware Nodes Registered Yet</p>
              <p className="text-slate-400 max-w-sm mx-auto text-[11px]">
                Run a test in the <a href="/dashboard/simulator" className="text-cyan-400 underline">Interactive Simulator</a> or execute <code className="text-indigo-300">POST /v1/verify-trial</code> to create real persistent device graph nodes!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const hasMultiAccounts = node.associated_accounts.length > 1;

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-4 rounded-2xl cursor-pointer border transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border-indigo-500 shadow-glow-violet'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-white truncate max-w-[150px]">{node.id}</span>
                      {node.blocked ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1 font-bold">
                          <ShieldAlert className="w-3 h-3" /> BLOCKED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 font-mono">
                      <div className="truncate">Platform: <span className="text-cyan-400 uppercase">{node.traits.os_platform}</span></div>
                      <div className="truncate">GPU: <span className="text-slate-200">{node.traits.gpu_renderer || 'Hardware Driver'}</span></div>
                      <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-900">
                        <span>Linked Accounts:</span>
                        <span className={`font-bold ${hasMultiAccounts ? 'text-amber-400 font-mono' : 'text-slate-300'}`}>
                          {node.associated_accounts.length} {hasMultiAccounts && '⚠️'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Node Details Panel */}
        {selectedNode ? (
          <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Selected Physical Device</span>
                <h3 className="font-bold text-sm text-white font-mono truncate">{selectedNode.id}</h3>
              </div>
              <button
                onClick={() => toggleBlockNode(selectedNode.id, selectedNode.blocked)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  selectedNode.blocked
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-glow-emerald'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-glow-rose'
                }`}
              >
                {selectedNode.blocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {selectedNode.blocked ? 'Unblock Node' : 'Block Node'}
              </button>
            </div>

            {/* Trait Matrix */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] font-mono">Hardware Trait Breakdown</div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 font-mono text-[11px]">
                {selectedNode.traits.windows_guid && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">MachineGuid:</span>
                    <span className="text-purple-400 truncate max-w-[150px] font-bold">{selectedNode.traits.windows_guid}</span>
                  </div>
                )}
                {selectedNode.traits.keychain_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">iOS Keychain:</span>
                    <span className="text-cyan-400 truncate max-w-[150px] font-bold">{selectedNode.traits.keychain_id}</span>
                  </div>
                )}
                {selectedNode.traits.widevine_drm_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Widevine DRM:</span>
                    <span className="text-indigo-400 truncate max-w-[150px] font-bold">{selectedNode.traits.widevine_drm_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">OS Platform:</span>
                  <span className="text-white uppercase font-bold">{selectedNode.traits.os_platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GPU Renderer:</span>
                  <span className="text-slate-200 truncate max-w-[150px]">{selectedNode.traits.gpu_renderer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CPU Cores:</span>
                  <span className="text-slate-200">{selectedNode.traits.cpu_cores} Cores</span>
                </div>
              </div>
            </div>

            {/* Linked Accounts */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] font-mono">
                Associated Accounts ({selectedNode.associated_accounts.length})
              </div>
              <div className="space-y-2">
                {selectedNode.associated_accounts.map((acc, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 truncate">
                    {acc}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-cyber p-6 rounded-3xl border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono text-center">
            Select a device node from the list to inspect hardware traits and manage block overrides.
          </div>
        )}
      </div>
    </div>
  );
}
