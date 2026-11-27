// The verification pipeline: IP policy -> device match -> trial decision -> audit log.

import { newId } from './crypto.ts';
import { checkAndRegister, claimTrial } from './devices.ts';
import { HttpError, type Env, type Workspace } from './http.ts';
import { inspectIP, isAnonymized, type IPCheckResult, type NetworkInfo } from './ipintel.ts';
import { hasEnoughSignal, sanitizeTraits } from './matcher.ts';
import type { BucketResult } from './bucket.ts';

export type Decision =
  | 'ALLOWED'
  | 'BLOCKED_TRIAL_REUSED'
  | 'BLOCKED_OVERRIDE'
  | 'BLOCKED_VPN'
  | 'INSUFFICIENT_SIGNALS';

export interface VerifyInput {
  account_id: unknown;
  hardware_traits: unknown;
  require_no_vpn?: unknown;
}

export interface VerifyResult {
  verification_id: string;
  decision: Decision;
  allowed: boolean;
  reason: string;
  device_id: string | null;
  new_device: boolean;
  similarity_score: number;
  deterministic: boolean;
  trial_claimed: boolean;
  ip_check: IPCheckResult | null;
  rate_limit: BucketResult | null;
  verified_at: string;
}

/** Network details of the end user's connection, when the end user is the caller. */
export function networkFromRequest(request: Request): NetworkInfo {
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf;
  return {
    ip: request.headers.get('CF-Connecting-IP') ?? '',
    asn: typeof cf?.asn === 'number' ? cf.asn : undefined,
    org: typeof cf?.asOrganization === 'string' ? cf.asOrganization : undefined,
    country: typeof cf?.country === 'string' ? cf.country : undefined,
  };
}

async function record(
  env: Env,
  ws: Workspace,
  r: VerifyResult,
  accountId: string,
  source: string,
  now: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO verifications
       (id, workspace_id, account_id, node_id, client_ip, ip_json, match_score, deterministic,
        decision, allowed, reason, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      r.verification_id,
      ws.id,
      accountId,
      r.device_id,
      r.ip_check?.ip ?? null,
      r.ip_check ? JSON.stringify(r.ip_check) : null,
      r.similarity_score,
      r.deterministic ? 1 : 0,
      r.decision,
      r.allowed ? 1 : 0,
      r.reason,
      source,
      now,
    )
    .run();
}

const MATCH_LABELS: Record<string, string> = {
  keychain_id: 'Keychain identifier',
  widevine_drm_id: 'Widevine DRM identifier',
  windows_guid: 'Windows MachineGuid',
  io_platform_uuid: 'macOS platform UUID',
  smbios_serial: 'SMBIOS serial',
  machine_id: 'machine ID',
  idfv: 'vendor identifier',
  storage_id: 'stored device token',
};

/**
 * Runs one verification.
 *
 * `network` is the end user's connection when they called us directly (client
 * SDK with a publishable key). It is null for server-to-server calls, where the
 * connection belongs to the developer's server and says nothing about the user.
 */
export async function runVerification(
  env: Env,
  ws: Workspace,
  input: VerifyInput,
  network: NetworkInfo | null,
  rateLimit: BucketResult | null,
  source: string,
): Promise<VerifyResult> {
  const accountId = typeof input.account_id === 'string' ? input.account_id.trim() : '';
  if (!accountId || accountId.length > 256) {
    throw new HttpError(400, 'invalid_account_id', 'account_id is required (string, 1-256 characters)');
  }
  if (!input.hardware_traits || typeof input.hardware_traits !== 'object') {
    throw new HttpError(400, 'invalid_traits', 'hardware_traits is required (object)');
  }
  const requireNoVpn = input.require_no_vpn === true;
  if (requireNoVpn && !network) {
    throw new HttpError(
      400,
      'ip_check_unavailable',
      'require_no_vpn needs the end user\'s connection: call verify from the client SDK with a publishable key, then confirm the result from your server with GET /v1/verifications/{id}.',
    );
  }

  const now = Date.now();
  const traits = sanitizeTraits(input.hardware_traits);
  const ipCheck = network ? inspectIP(network) : null;

  const base = {
    verification_id: newId('ver'),
    ip_check: ipCheck,
    rate_limit: rateLimit,
    verified_at: new Date(now).toISOString(),
  };

  let result: VerifyResult;

  if (requireNoVpn && ipCheck && isAnonymized(ipCheck)) {
    const kind = ipCheck.is_tor ? 'Tor exit node' : ipCheck.is_vpn ? 'VPN or proxy network' : 'Datacenter network';
    result = {
      ...base,
      decision: 'BLOCKED_VPN',
      allowed: false,
      reason: `${kind} detected${ipCheck.org ? ` (${ipCheck.org})` : ''}`,
      device_id: null,
      new_device: false,
      similarity_score: 0,
      deterministic: false,
      trial_claimed: false,
    };
  } else if (!hasEnoughSignal(traits)) {
    result = {
      ...base,
      decision: 'INSUFFICIENT_SIGNALS',
      allowed: false,
      reason:
        'The traits contain no hardware identifier and no canvas or WebGL fingerprint, so the device cannot be told apart from others.',
      device_id: null,
      new_device: false,
      similarity_score: 0,
      deterministic: false,
      trial_claimed: false,
    };
  } else {
    const match = await checkAndRegister(env, ws, traits, accountId, now);
    const how = match.isNew
      ? 'new device registered'
      : match.deterministic
        ? `matched on ${MATCH_LABELS[match.matchedOn ?? ''] ?? 'hardware identifier'}`
        : `fingerprint similarity ${match.score.toFixed(3)} ≥ ${ws.match_threshold}`;

    let decision: Decision;
    let reason: string;
    let trialClaimed = true;

    if (match.blocked) {
      decision = 'BLOCKED_OVERRIDE';
      reason = `Device blocked by an administrator${match.blockReason ? `: ${match.blockReason}` : ''}`;
      trialClaimed = false;
    } else {
      const trial = await claimTrial(env, match.nodeId, accountId, now);
      if (trial === 'granted') {
        decision = 'ALLOWED';
        reason = `Free trial granted (${how})`;
      } else if (trial === 'owner') {
        decision = 'ALLOWED';
        reason = `Account already holds the trial on this device (${how})`;
      } else {
        decision = 'BLOCKED_TRIAL_REUSED';
        reason = `Free trial already claimed on this device by another account (${how})`;
      }
    }

    result = {
      ...base,
      decision,
      allowed: decision === 'ALLOWED',
      reason,
      device_id: match.nodeId,
      new_device: match.isNew,
      similarity_score: match.score,
      deterministic: match.deterministic,
      trial_claimed: trialClaimed,
    };
  }

  await record(env, ws, result, accountId, source, now);
  return result;
}

export interface VerificationView {
  id: string;
  timestamp: string;
  account_id: string | null;
  device_id: string | null;
  client_ip: string | null;
  ip_check: IPCheckResult | null;
  similarity_score: number;
  deterministic: boolean;
  decision: string;
  allowed: boolean;
  reason: string | null;
  source: string | null;
}

interface VerificationRow {
  id: string;
  account_id: string | null;
  node_id: string | null;
  client_ip: string | null;
  ip_json: string | null;
  match_score: number;
  deterministic: number;
  decision: string;
  allowed: number;
  reason: string | null;
  source: string | null;
  created_at: number;
}

function toView(r: VerificationRow): VerificationView {
  let ip: IPCheckResult | null = null;
  if (r.ip_json) {
    try {
      ip = JSON.parse(r.ip_json) as IPCheckResult;
    } catch {
      ip = null;
    }
  }
  return {
    id: r.id,
    timestamp: new Date(r.created_at).toISOString(),
    account_id: r.account_id,
    device_id: r.node_id,
    client_ip: r.client_ip,
    ip_check: ip,
    similarity_score: r.match_score,
    deterministic: r.deterministic === 1,
    decision: r.decision,
    allowed: r.allowed === 1,
    reason: r.reason,
    source: r.source,
  };
}

export async function listVerifications(
  env: Env,
  workspaceId: string,
  limit: number,
): Promise<VerificationView[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM verifications WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?',
  )
    .bind(workspaceId, limit)
    .all<VerificationRow>();
  return results.map(toView);
}

export async function getVerification(
  env: Env,
  workspaceId: string,
  id: string,
): Promise<VerificationView> {
  const row = await env.DB.prepare('SELECT * FROM verifications WHERE id = ? AND workspace_id = ?')
    .bind(id, workspaceId)
    .first<VerificationRow>();
  if (!row) throw new HttpError(404, 'verification_not_found', 'No verification with that ID in this workspace');
  return toView(row);
}

export async function workspaceStats(env: Env, workspaceId: string): Promise<Record<string, number>> {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const [v, d, m] = await env.DB.batch<Record<string, number>>([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN allowed = 0 THEN 1 ELSE 0 END), 0) AS blocked,
              COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS last_24h,
              COALESCE(SUM(CASE WHEN created_at >= ? AND allowed = 0 THEN 1 ELSE 0 END), 0) AS blocked_24h
         FROM verifications WHERE workspace_id = ?`,
    ).bind(dayAgo, dayAgo, workspaceId),
    env.DB.prepare(
      `SELECT COUNT(*) AS devices,
              COALESCE(SUM(blocked), 0) AS blocked_devices
         FROM device_nodes WHERE workspace_id = ?`,
    ).bind(workspaceId),
    env.DB.prepare(
      `SELECT COUNT(*) AS multi FROM (
         SELECT l.node_id FROM account_links l
           JOIN device_nodes n ON n.id = l.node_id
          WHERE n.workspace_id = ?
          GROUP BY l.node_id HAVING COUNT(*) > 1)`,
    ).bind(workspaceId),
  ]);
  const vr = v.results[0] ?? {};
  const dr = d.results[0] ?? {};
  const mr = m.results[0] ?? {};
  return {
    verifications_total: vr.total ?? 0,
    verifications_blocked: vr.blocked ?? 0,
    verifications_24h: vr.last_24h ?? 0,
    verifications_blocked_24h: vr.blocked_24h ?? 0,
    devices: dr.devices ?? 0,
    devices_blocked: dr.blocked_devices ?? 0,
    devices_multi_account: mr.multi ?? 0,
  };
}
