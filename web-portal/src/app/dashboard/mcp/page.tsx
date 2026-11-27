'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import { CodeBlock, CopyButton, PageHeader } from '@/components/ui';

const TOOLS: [string, string][] = [
  ['ironfist_verify_device', 'Checks whether an account may claim a trial on a device.'],
  ['ironfist_list_devices', 'Lists known devices with their linked accounts.'],
  ['ironfist_get_device', 'Shows one device: traits, accounts, trial and block status.'],
  ['ironfist_override_device', 'Blocks or unblocks a device.'],
  ['ironfist_recent_verifications', 'Returns the latest verification decisions.'],
  ['ironfist_check_token_bucket', 'Takes tokens from a named rate-limit bucket.'],
];

type Tab = 'claude' | 'cursor' | 'curl';

export default function McpPage() {
  const [origin, setOrigin] = useState('https://YOUR-IRONFIST-URL');
  const [tab, setTab] = useState<Tab>('claude');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = `${origin}/mcp`;
  const key = 'if_sk_YOUR_SECRET_KEY';

  const snippets: Record<Tab, { label: string; note: string; code: string }> = {
    claude: {
      label: 'Claude Code',
      note: 'Run this in your terminal:',
      code: `claude mcp add --transport http ironfist ${url} \\\n  --header "Authorization: Bearer ${key}"`,
    },
    cursor: {
      label: 'Cursor / JSON config',
      note: 'Add to .cursor/mcp.json, or any client that takes a JSON server list:',
      code: JSON.stringify(
        { mcpServers: { ironfist: { url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      ),
    },
    curl: {
      label: 'curl',
      note: 'Check the endpoint by listing its tools:',
      code: `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    },
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Model Context Protocol" title="MCP for AI Agents" icon={<Cpu className="w-4 h-4" />}>
        Connect an AI coding agent to this workspace so it can inspect devices, read the verification log and block
        abusers. The endpoint speaks MCP over HTTP and is authenticated with a secret key.
      </PageHeader>

      <div className="glass-cyber-glow p-6 rounded-2xl space-y-3">
        <h3 className="font-bold text-lg text-white">Endpoint</h3>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
          <code className="text-xs sm:text-sm font-mono text-cyan-300 truncate flex-1">{url}</code>
          <CopyButton text={url} />
        </div>
        <p className="text-xs text-slate-400">
          Replace <code className="text-cyan-300">{key}</code> below with a secret key from the{' '}
          <Link href="/dashboard/keys" className="text-cyan-400 hover:underline">
            API Keys
          </Link>{' '}
          page. Create a dedicated key for each agent so you can revoke it on its own.
        </p>
      </div>

      <div className="glass-cyber p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono w-fit">
          {(Object.keys(snippets) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === t ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {snippets[t].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-300">{snippets[tab].note}</p>
        <CodeBlock code={snippets[tab].code} />
      </div>

      <div className="glass-cyber p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="font-bold text-lg text-white">Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {TOOLS.map(([name, desc]) => (
            <div key={name} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="font-mono text-cyan-400 font-bold">{name}</div>
              <p className="text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
