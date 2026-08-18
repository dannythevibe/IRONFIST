'use client';

import { useState, useEffect } from 'react';
import { Terminal, Play, ShieldAlert, CheckCircle2, RefreshCw, Cpu, Monitor, Smartphone, Zap, Laptop } from 'lucide-react';

export default function SimulatorPage() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'macos' | 'windows'>('windows');
  const [accountId, setAccountId] = useState('danny_test_user@ironfist.dev');
  const [requireNoVpn, setRequireNoVpn] = useState(false);
  const [simulateVpnIp, setSimulateVpnIp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectingSystem, setDetectingSystem] = useState(false);
  const [responseJson, setResponseJson] = useState<any>(null);

  // Editable trait inputs
  const [keychainID, setKeychainID] = useState('');
  const [widevineID, setWidevineID] = useState('');
  const [windowsGuid, setWindowsGuid] = useState('');
  const [ioPlatformUUID, setIoPlatformUUID] = useState('');
  const [gpuRenderer, setGpuRenderer] = useState('NVIDIA GeForce RTX / Direct3D 11');
  const [resolution, setResolution] = useState('1920x1080');
  const [cpuCores, setCpuCores] = useState(8);

  const fetchRealHostTraits = async () => {
    setDetectingSystem(true);
    try {
      const res = await fetch('http://localhost:8080/v1/collect-local-traits');
      if (res.ok) {
        const data = await res.json();
        if (data.os_platform) setPlatform(data.os_platform as any);
        if (data.windows_guid) setWindowsGuid(data.windows_guid);
        if (data.io_platform_uuid) setIoPlatformUUID(data.io_platform_uuid);
        if (data.gpu_renderer) setGpuRenderer(data.gpu_renderer);
        if (data.cpu_cores) setCpuCores(data.cpu_cores);
        if (data.screen_resolution) setResolution(data.screen_resolution);
      }
    } catch (err) {
      console.error('Failed to reach local Go gateway:', err);
    } finally {
      setDetectingSystem(false);
    }
  };

  useEffect(() => {
    fetchRealHostTraits();
  }, []);

  const runSimulation = async () => {
    setLoading(true);

    const traits: any = {
      os_platform: platform,
      cpu_cores: Number(cpuCores),
      memory_gb: 16,
      gpu_renderer: gpuRenderer,
      screen_resolution: resolution,
    };

    if (platform === 'ios' || platform === 'macos') {
      if (keychainID) traits.keychain_id = keychainID;
      if (ioPlatformUUID) traits.io_platform_uuid = ioPlatformUUID;
    }
    if (platform === 'android') {
      if (widevineID) traits.widevine_drm_id = widevineID;
    }
    if (platform === 'windows') {
      if (windowsGuid) traits.windows_guid = windowsGuid;
    }

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (simulateVpnIp) {
        headers['X-Forwarded-For'] = '104.28.14.88';
      }

      const res = await fetch('http://localhost:8080/v1/verify-trial', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          api_key: 'if_live_9a8b7c6d5e4f3a2b',
          account_id: accountId,
          hardware_traits: traits,
          require_no_vpn: requireNoVpn,
        }),
      });

      const data = await res.json();
      setResponseJson(data);
    } catch (err: any) {
      setResponseJson({
        error: `Could not connect to Go Edge Gateway at http://localhost:8080 (${err.message}). Ensure backend server is started!`,
      });
    } finally {
      setLoading(false);
    }
  };

  const randomizeTraits = () => {
    const randomHex = () => Math.random().toString(36).substring(2, 10);
    setKeychainID(`kc_${randomHex()}`);
    setWidevineID(`widevine_${randomHex()}`);
    setWindowsGuid(`${randomHex()}-${randomHex()}-4a2b-1c0d-${randomHex()}`);
    setAccountId(`user_${randomHex()}@ironfist.dev`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-widest mb-1">
            <Terminal className="w-4 h-4" /> Real Hardware Verification Studio
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Interactive Verification Simulator</h1>
          <p className="text-slate-400 text-xs mt-1">
            Tests real-time hardware trait matching, persistent GUID checks, and trial eligibility against the Go Gateway.
          </p>
        </div>

        <button
          onClick={fetchRealHostTraits}
          disabled={detectingSystem}
          className="px-4 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-2 transition-all self-start sm:self-auto shadow-glow-cyan"
        >
          <Laptop className={`w-4 h-4 text-cyan-400 ${detectingSystem ? 'animate-spin' : ''}`} />
          {detectingSystem ? 'Reading PC Hardware...' : 'Read My Host Machine Traits'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls Column */}
        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Client Hardware Trait Payload</h3>
            <button
              onClick={randomizeTraits}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Randomize Signals
            </button>
          </div>

          {/* Platform Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase">Target OS Platform</label>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              {(['ios', 'android', 'macos', 'windows'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`p-2.5 rounded-xl border uppercase font-bold transition-all ${
                    platform === p
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-glow-cyan'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Account ID input */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase">Account Email / User ID</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Persistent ID input based on platform */}
          {platform === 'windows' && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase">Windows Registry MachineGuid</label>
              <input
                type="text"
                value={windowsGuid}
                onChange={(e) => setWindowsGuid(e.target.value)}
                placeholder="Reads real machine GUID automatically"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {(platform === 'ios' || platform === 'macos') && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase">Keychain / IOPlatformUUID</label>
              <input
                type="text"
                value={keychainID || ioPlatformUUID}
                onChange={(e) => {
                  setKeychainID(e.target.value);
                  setIoPlatformUUID(e.target.value);
                }}
                placeholder="Keychain persistent identifier"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase">Widevine DRM ID</label>
              <input
                type="text"
                value={widevineID}
                onChange={(e) => setWidevineID(e.target.value)}
                placeholder="MediaDrm Widevine Unique ID"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Soft traits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase">GPU Renderer</label>
              <input
                type="text"
                value={gpuRenderer}
                onChange={(e) => setGpuRenderer(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase">CPU Cores</label>
              <input
                type="number"
                value={cpuCores}
                onChange={(e) => setCpuCores(Number(e.target.value))}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Options Toggles */}
          <div className="space-y-3 pt-4 border-t border-slate-800 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireNoVpn}
                onChange={(e) => setRequireNoVpn(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-300 font-medium">Require Residential IP (Block VPN & Datacenter Subnets)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={simulateVpnIp}
                onChange={(e) => setSimulateVpnIp(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-300 font-medium">Simulate Cloud Datacenter / VPN Client IP (104.28.14.88)</span>
            </label>
          </div>

          {/* Submit Action */}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-glow-cyan transition-all transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            {loading ? 'Executing Gateway Verification...' : 'Execute Live Verification Request'}
          </button>
        </div>

        {/* Results JSON Output Column */}
        <div className="glass-cyber p-6 rounded-3xl border border-slate-800 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white font-mono">Live Gateway JSON Stream</h3>
            {responseJson && (
              <span
                className={`text-xs font-mono px-3 py-1 rounded-full font-bold ${
                  responseJson.allowed
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {responseJson.decision || (responseJson.error ? 'ERROR' : 'RESPONSE')}
              </span>
            )}
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-cyan-300 overflow-y-auto max-h-[550px]">
            {responseJson ? (
              <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(responseJson, null, 2)}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6 space-y-3">
                <Terminal className="w-8 h-8 text-slate-600" />
                <p className="text-xs">
                  Click <strong className="text-cyan-400">"Read My Host Machine Traits"</strong> above or adjust properties and click <strong className="text-white">"Execute Live Verification Request"</strong> to send a real HTTP call to Go Edge Gateway on <code className="text-indigo-400 font-mono">http://localhost:8080/v1/verify-trial</code>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
