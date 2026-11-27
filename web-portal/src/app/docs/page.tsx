'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CodeBlock } from '@/components/ui';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-white tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">{children}</p>
);
const C = ({ children }: { children: React.ReactNode }) => (
  <code className="text-cyan-300 font-mono text-[0.85em]">{children}</code>
);

const ENDPOINTS: [string, string, string, string][] = [
  ['POST', '/v1/verify', 'publishable or secret', 'Check a device and claim the trial for an account.'],
  ['GET', '/v1/verifications/{id}', 'secret', 'Confirm a verification from your server.'],
  ['GET', '/v1/verifications', 'secret', 'Recent verifications (limit up to 200).'],
  ['GET', '/v1/devices', 'secret', 'Known devices, most recently seen first.'],
  ['GET', '/v1/devices/{id}', 'secret', 'One device with its accounts and status.'],
  ['POST', '/v1/devices/{id}/override', 'secret', 'Block or unblock a device: { blocked, reason }.'],
  ['POST', '/v1/devices/{id}/reset-trial', 'secret', 'Clear a device’s trial claim.'],
  ['POST', '/v1/token-bucket/check', 'secret', 'General-purpose rate limiter: { key, capacity, refill_rate, requested }.'],
  ['POST', '/mcp', 'secret', 'Model Context Protocol endpoint for AI agents.'],
];

const DECISIONS: [string, string][] = [
  ['ALLOWED', 'The account may have the trial: the device is new, or this account already holds the trial on it.'],
  ['BLOCKED_TRIAL_REUSED', 'A different account already claimed the trial on this device.'],
  ['BLOCKED_OVERRIDE', 'You blocked this device.'],
  ['BLOCKED_VPN', 'require_no_vpn was set and the connection came from a datacenter, VPN, proxy or Tor.'],
  ['INSUFFICIENT_SIGNALS', 'The traits had no hardware identifier and no canvas/WebGL fingerprint.'],
  ['RATE_LIMITED', 'The workspace exceeded its verification rate limit (HTTP 429).'],
];

export default function DocsPage() {
  const [origin, setOrigin] = useState('https://YOUR-IRONFIST-URL');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="min-h-screen bg-cyber-bg text-slate-100">
      <header className="sticky top-0 z-50 glass-cyber border-b border-slate-800/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="IronFist" width={32} height={32} className="rounded-lg" />
            <span className="font-extrabold text-lg tracking-wider text-white font-mono">IRONFIST</span>
            <span className="text-xs text-slate-400 font-mono">Docs</span>
          </Link>
          <Link href="/dashboard" className="px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-slate-100">
            Open console
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-14">
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Developer guide</h1>
          <P>
            IronFist tells you whether a device has already used a free trial, even when the person signs up with a new
            account, reinstalls your app or clears their browser. Base URL: <C>{origin}</C>
          </P>
        </div>

        <Section id="quickstart" title="Quickstart">
          <P>
            1. <Link href="/signup" className="text-cyan-400 hover:underline">Create an account</Link>. You get a
            publishable key (<C>if_pk_…</C>) for your app and a secret key (<C>if_sk_…</C>) for your server.
          </P>
          <P>2. In your app, fingerprint the device and ask for a decision:</P>
          <CodeBlock
            code={`import { IronFistClient } from './ironfist'; // sdks/js-client

const ironfist = new IronFistClient({
  apiKey: 'if_pk_YOUR_PUBLISHABLE_KEY',
  baseUrl: '${origin}',
});

const result = await ironfist.verify(user.id, { requireNoVpn: false });
// Send result.verification_id to your server with the signup request.`}
          />
          <P>
            3. On your server, confirm it before granting anything. The browser belongs to the user, so a decision that
            only the browser saw can be faked.
          </P>
          <CodeBlock
            code={`import { IronFistServer } from './ironfist';

const ironfist = new IronFistServer({
  secretKey: process.env.IRONFIST_SECRET_KEY,
  baseUrl: '${origin}',
});

if (await ironfist.confirm(verificationId, user.id)) {
  startFreeTrial(user);
} else {
  requirePayment(user);
}`}
          />
        </Section>

        <Section id="auth" title="Authentication">
          <P>
            Send your key as <C>Authorization: Bearer &lt;key&gt;</C>. Publishable keys can only call{' '}
            <C>/v1/verify</C>, so they are safe to ship in client code. Everything else needs a secret key. Keys are
            created and revoked in the console, and are stored only as hashes.
          </P>
        </Section>

        <Section id="verify" title="Verify a device">
          <CodeBlock
            code={`curl -X POST ${origin}/v1/verify \\
  -H "Authorization: Bearer if_pk_YOUR_PUBLISHABLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "user_123",
    "require_no_vpn": false,
    "hardware_traits": {
      "os_platform": "windows",
      "windows_guid": "EXAMPLE-GUID",
      "gpu_renderer": "NVIDIA GeForce RTX 4070",
      "cpu_cores": 16
    }
  }'`}
          />
          <CodeBlock
            code={`{
  "verification_id": "ver_3f9c…",
  "decision": "ALLOWED",
  "allowed": true,
  "reason": "Free trial granted (new device registered)",
  "device_id": "dev_a81b…",
  "new_device": true,
  "similarity_score": 0,
  "deterministic": false,
  "trial_claimed": true,
  "ip_check": { "available": true, "is_datacenter": false, "is_vpn": false, "is_tor": false,
                "asn": 29465, "org": "…", "country": "NG", "risk_score": 5, "ip": "…" },
  "rate_limit": { "allowed": true, "remaining": 99, "capacity": 100, "refill_rate": 5, "retry_after": 0 },
  "verified_at": "2026-01-01T00:00:00.000Z"
}`}
          />
          <P>
            A completed check returns HTTP 200 whatever the decision; read <C>allowed</C>. Only rate limiting (429) and
            bad requests (4xx) use error statuses.
          </P>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <tbody>
                {DECISIONS.map(([d, text]) => (
                  <tr key={d} className="border-b border-slate-900 last:border-0">
                    <td className="p-3 font-mono text-cyan-300 whitespace-nowrap align-top">{d}</td>
                    <td className="p-3 text-slate-300">{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="matching" title="How devices are recognised">
          <P>
            <strong className="text-white">Hardware identifiers</strong> (iOS Keychain ID, Android Widevine ID, Windows
            MachineGuid, macOS platform UUID, SMBIOS serial, Linux machine ID) match exactly. They survive app
            reinstalls. IronFist hashes them before storing, so the raw values never rest in the database.
          </P>
          <P>
            <strong className="text-white">Browser fingerprints</strong> are scored for similarity: canvas and WebGL
            hashes carry most of the weight, with GPU, screen, CPU, memory, timezone and language as supporting
            signals. A score at or above your workspace threshold (default 0.88) counts as the same device. This is how
            a browser is recognised after its storage is wiped.
          </P>
          <P>
            Fingerprint matching is probabilistic. Two people with the same laptop model, browser and settings can
            produce the same fingerprint, and a determined user can change theirs. Treat a fingerprint-only block as a
            strong hint and give users a support path; <C>POST /v1/devices/{'{id}'}/reset-trial</C> undoes a wrong one.
          </P>
          <P>
            The IP check uses the network owner Cloudflare reports for the connection. It catches hosting providers,
            the networks most commercial VPNs run on, and Tor. It cannot see a VPN that exits through a home
            connection.
          </P>
        </Section>

        <Section id="reference" title="Endpoints">
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="p-3 font-medium">Method</th>
                  <th className="p-3 font-medium">Path</th>
                  <th className="p-3 font-medium">Key</th>
                  <th className="p-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(([method, path, key, purpose]) => (
                  <tr key={method + path} className="border-b border-slate-900 last:border-0">
                    <td className="p-3 font-mono text-emerald-400">{method}</td>
                    <td className="p-3 font-mono text-cyan-300 whitespace-nowrap">{path}</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{key}</td>
                    <td className="p-3 text-slate-300">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Errors look like <C>{'{ "error": { "code": "invalid_api_key", "message": "…" } }'}</C>. Rate-limited
            responses carry a <C>Retry-After</C> header.
          </P>
        </Section>

        <Section id="sdks" title="SDKs">
          <P>
            The repository includes collectors for the web (TypeScript), iOS (Swift), Android (Kotlin) and desktop
            (Rust) under <C>sdks/</C>. They are source files to copy into your project; they are not yet published to
            npm, CocoaPods, Maven or crates.io.
          </P>
        </Section>
      </main>
    </div>
  );
}
