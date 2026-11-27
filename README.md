<div align="center">
  <img src="./logo.jpg" alt="IRONFIST Logo" width="110" />
  <h1>IRONFIST</h1>
  <p><b>Device fingerprinting and anti-abuse API</b></p>
  <p>
    <a href="https://ironfist.theobsidianstudios0.workers.dev">Hosted service</a> •
    <a href="https://ironfist.theobsidianstudios0.workers.dev/docs">Docs</a> •
    <a href="#quick-start">Quick start</a> •
    <a href="#api">API</a> •
    <a href="#run-it-yourself">Run it yourself</a>
  </p>
</div>

---

IronFist tells you whether a device has already used your free trial, even when the person signs up with a new account, reinstalls your app, or clears their browser. It also gives you a rate limiter and an MCP endpoint so AI agents can inspect and manage your device graph.

It runs entirely on Cloudflare: one Worker serves the API, the console and the MCP endpoint, with D1 for storage and Durable Objects for rate limiting.

**Hosted at:** https://ironfist.theobsidianstudios0.workers.dev

## Quick start

1. Create an account at `https://ironfist.theobsidianstudios0.workers.dev/signup`. You get a workspace and two keys:
   - a **publishable key** (`if_pk_…`) for your app or website. It can only submit verifications.
   - a **secret key** (`if_sk_…`) for your server. Never ship it in client code.

2. In your app, fingerprint the device and ask for a decision:

   ```ts
   import { IronFistClient } from './ironfist'; // copy of sdks/js-client/index.ts

   const ironfist = new IronFistClient({ apiKey: 'if_pk_…', baseUrl: 'https://ironfist.theobsidianstudios0.workers.dev' });
   const result = await ironfist.verify(user.id);
   // Send result.verification_id to your server along with the signup request.
   ```

3. On your server, confirm the result before granting anything. The browser belongs to the user, so a decision only the browser saw can be faked.

   ```ts
   import { IronFistServer } from './ironfist';

   const ironfist = new IronFistServer({ secretKey: process.env.IRONFIST_SECRET_KEY, baseUrl: 'https://ironfist.theobsidianstudios0.workers.dev' });

   if (await ironfist.confirm(verificationId, user.id)) startFreeTrial(user);
   else requirePayment(user);
   ```

Or call it directly:

```bash
curl -X POST https://ironfist.theobsidianstudios0.workers.dev/v1/verify \
  -H "Authorization: Bearer if_pk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"account_id":"user_123","hardware_traits":{"os_platform":"windows","windows_guid":"EXAMPLE-GUID"}}'
```

## How it decides

Each verification runs three steps:

1. **Rate limit.** A token bucket per workspace (default: burst of 100, refilling 5 per second). Over the limit returns HTTP 429.
2. **IP policy.** If you pass `require_no_vpn: true`, connections from hosting providers, known VPN networks and Tor are refused. This uses the network owner Cloudflare reports for the connection, so it only applies when the end user's device calls IronFist directly.
3. **Device match.**
   - *Hardware identifiers* (iOS Keychain ID, Android Widevine ID, Windows MachineGuid, macOS platform UUID, SMBIOS serial, Linux machine ID) match exactly. They are hashed per workspace before storage.
   - *Browser fingerprints* are scored for similarity. Canvas and WebGL hashes carry most of the weight; GPU, screen, CPU, memory, timezone and language support them. A score at or above the workspace threshold (default 0.88) counts as the same device.
   - Otherwise the device is registered as new.

The first account to verify on a device claims its trial. That account stays `ALLOWED` on later checks; any other account gets `BLOCKED_TRIAL_REUSED`.

| Decision | Meaning |
| --- | --- |
| `ALLOWED` | New device, or this account already holds the trial on it |
| `BLOCKED_TRIAL_REUSED` | Another account already claimed the trial on this device |
| `BLOCKED_OVERRIDE` | You blocked this device |
| `BLOCKED_VPN` | `require_no_vpn` was set and the connection was a datacenter, VPN, proxy or Tor |
| `INSUFFICIENT_SIGNALS` | No hardware identifier and no canvas/WebGL fingerprint was sent |
| `RATE_LIMITED` | Workspace verification limit exceeded (HTTP 429) |

### Limits you should know about

- **Fingerprint matching is probabilistic.** Two people with the same laptop model, browser and settings can produce the same fingerprint, and a determined user can change theirs. Treat a fingerprint-only block as a strong hint and give users a support path. `POST /v1/devices/{id}/reset-trial` undoes a wrong one.
- **Client-reported traits can be forged.** Anyone with your publishable key can send made-up traits. IronFist raises the cost of trial farming; it does not make it impossible.
- **The IP check is a heuristic.** It cannot see a VPN that exits through a residential connection.
- **Sign-up has no email verification yet**, and passwords are hashed with PBKDF2-SHA256 at 100,000 iterations, the most Cloudflare Workers allows.

## API

Authenticate with `Authorization: Bearer <key>`.

| Method | Path | Key | Purpose |
| --- | --- | --- | --- |
| `POST` | `/v1/verify` | publishable or secret | Check a device and claim the trial for an account |
| `GET` | `/v1/verifications/{id}` | secret | Confirm a verification from your server |
| `GET` | `/v1/verifications` | secret | Recent verifications |
| `GET` | `/v1/devices` | secret | Known devices, most recently seen first |
| `GET` | `/v1/devices/{id}` | secret | One device with its accounts and status |
| `POST` | `/v1/devices/{id}/override` | secret | Block or unblock: `{ "blocked": true, "reason": "…" }` |
| `POST` | `/v1/devices/{id}/reset-trial` | secret | Clear a device's trial claim |
| `POST` | `/v1/token-bucket/check` | secret | General-purpose rate limiter: `{ "key", "capacity", "refill_rate", "requested" }` |
| `POST` | `/mcp` | secret | Model Context Protocol endpoint |

A completed verification returns HTTP 200 whatever the decision; read `allowed`. Errors look like `{ "error": { "code": "…", "message": "…" } }`.

### MCP for AI agents

```bash
claude mcp add --transport http ironfist https://ironfist.theobsidianstudios0.workers.dev/mcp \
  --header "Authorization: Bearer if_sk_YOUR_SECRET_KEY"
```

Tools: `ironfist_verify_device`, `ironfist_list_devices`, `ironfist_get_device`, `ironfist_override_device`, `ironfist_recent_verifications`, `ironfist_check_token_bucket`.

## SDKs

Source files to copy into your project. They are not published to npm, CocoaPods, Maven or crates.io yet.

| Platform | File | Identifier it collects | Status |
| --- | --- | --- | --- |
| Web / Node | [sdks/js-client/index.ts](sdks/js-client/index.ts) | Stored token, canvas and WebGL fingerprint | Used by the console; type-checked and built |
| iOS | [sdks/swift-ios/IronFist.swift](sdks/swift-ios/IronFist.swift) | Keychain ID, vendor ID | Not yet compiled or tested on a device |
| Android | [sdks/kotlin-android/IronFist.kt](sdks/kotlin-android/IronFist.kt) | Widevine ID (hashed), stored token | Not yet compiled or tested on a device |
| Desktop | [sdks/rust-desktop](sdks/rust-desktop) | MachineGuid / platform UUID / machine-id | Not yet compiled |

## Repository layout

```
worker/        Cloudflare Worker: API, MCP endpoint, D1 schema, tests
web-portal/    Next.js console and landing page (static export served by the Worker)
sdks/          Client SDKs
backend/       Legacy Go prototype. Not deployed and not maintained; see note below
mcp-server/    Legacy Node MCP server. Superseded by the Worker's /mcp endpoint
```

`backend/`, `mcp-server/` and `docker-compose.yml` are the original prototype. They have no authentication and are not what runs in production. They are kept for reference and can be deleted.

## Run it yourself

Requires Node 20+ and a Cloudflare account.

```bash
# 1. Build the console
cd web-portal && npm install && npm run build

# 2. Run the Worker locally (serves the console too, on http://localhost:8787)
cd ../worker && npm install
npm run migrate:local
npm run dev
```

To deploy to your own Cloudflare account:

```bash
cd worker
npx wrangler login
npx wrangler d1 create ironfist        # put the returned id in wrangler.jsonc
# set "account_id" in wrangler.jsonc to your account
npm run migrate:remote
npm run deploy
```

For console development with hot reload, run `npm run dev` in both `worker/` and `web-portal/`; the Next.js dev server on port 3000 proxies API calls to the Worker.

Tests and type checks:

```bash
cd worker && npm test && npm run typecheck
```

## License

Apache License 2.0. See [LICENSE](LICENSE).
