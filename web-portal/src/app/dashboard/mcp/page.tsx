'use client';

import { useState } from 'react';
import { Cpu, Copy, Check, Terminal, Code2, ShieldCheck, Zap } from 'lucide-react';

export default function MCPGeneratorPage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'cursor' | 'trae' | 'claude' | 'stdio'>('cursor');
  const [apiKey, setApiKey] = useState('if_live_9a8b7c6d5e4f3a2b');

  const mcpSseUrl = `https://mcp.ironfist.dev/v1/sse?key=${apiKey}`;

  const cursorConfig = `{
  "mcpServers": {
    "ironfist": {
      "url": "${mcpSseUrl}",
      "transport": "sse"
    }
  }
}`;

  const traeConfig = `{
  "mcpServers": {
    "ironfist-anti-abuse": {
      "url": "${mcpSseUrl}",
      "type": "sse"
    }
  }
}`;

  const claudeConfig = `{
  "mcpServers": {
    "ironfist": {
      "command": "npx",
      "args": ["-y", "@ironfist/mcp-server", "--stdio"],
      "env": {
        "IRONFIST_API_KEY": "${apiKey}",
        "IRONFIST_GATEWAY_URL": "http://localhost:8080"
      }
    }
  }
}`;

  const stdioCmd = `npx -y @ironfist/mcp-server --stdio`;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
          <Cpu className="w-4 h-4" /> Protocol Provisioning
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Model Context Protocol (MCP) Link Generator</h1>
        <p className="text-slate-400 text-sm mt-1">
          Generate an SSE MCP link or Stdio configuration to empower AI coding agents (Cursor, Trae, Claude Code) to wire up anti-abuse protection instantly.
        </p>
      </div>

      {/* Dynamic Link Generator Box */}
      <div className="glass-panel-glow p-6 rounded-2xl border border-cyan-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg text-white">Your Secured MCP Server Link</h3>
            <p className="text-xs text-slate-400">Tied to API Key: <code className="text-cyan-400 font-mono">{apiKey}</code></p>
          </div>

          <button
            onClick={() => copyText(mcpSseUrl)}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all self-start sm:self-auto"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Link!' : 'Copy SSE Link'}
          </button>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <code className="text-xs sm:text-sm font-mono text-cyan-300 truncate flex-1">{mcpSseUrl}</code>
        </div>
      </div>

      {/* Tabbed IDE Snippet Configurations */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" /> AI Agent Setup Instructions
          </h3>

          <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('cursor')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'cursor' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cursor IDE
            </button>
            <button
              onClick={() => setActiveTab('trae')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'trae' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trae Agent
            </button>
            <button
              onClick={() => setActiveTab('claude')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'claude' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Claude Code
            </button>
            <button
              onClick={() => setActiveTab('stdio')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'stdio' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stdio CLI
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'cursor' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Add the following to your project's <code className="text-cyan-400 font-mono">.cursor/mcp.json</code>:
            </p>
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
                {cursorConfig}
              </pre>
              <button
                onClick={() => copyText(cursorConfig)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'trae' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Paste into Trae MCP Config (<code className="text-cyan-400 font-mono">mcp.json</code>):
            </p>
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 overflow-x-auto">
                {traeConfig}
              </pre>
              <button
                onClick={() => copyText(traeConfig)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'claude' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Add to <code className="text-cyan-400 font-mono">claude_desktop_config.json</code>:
            </p>
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-purple-300 overflow-x-auto">
                {claudeConfig}
              </pre>
              <button
                onClick={() => copyText(claudeConfig)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stdio' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">Launch directly from command line via Stdio transport:</p>
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                {stdioCmd}
              </pre>
              <button
                onClick={() => copyText(stdioCmd)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Native Tools Breakdown */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-bold text-lg text-white">Exposed MCP Server Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="font-mono text-cyan-400 font-bold text-sm">ironfist_verify_device</div>
            <p className="text-slate-400">
              Evaluates hardware traits, IDFV/Keychain/Widevine/MachineGuid, rate limits, and trial eligibility.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="font-mono text-indigo-400 font-bold text-sm">ironfist_check_token_bucket</div>
            <p className="text-slate-400">
              Queries atomic Redis Lua token bucket for remaining capacity and refill timing.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="font-mono text-purple-400 font-bold text-sm">ironfist_override_user</div>
            <p className="text-slate-400">
              Manually whitelists or blocks a target device node ID for customer support or fraud enforcement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
