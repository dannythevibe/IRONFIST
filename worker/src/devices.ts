// Device graph storage on D1: lookup, registration, trial claims, overrides.

import { randomHex, sha256Hex } from './crypto.ts';
import { HttpError, type Env, type Workspace } from './http.ts';
import {
  calculateSimilarity,
  canFuzzyMatch,
  hasHardIdConflict,
  ID_TYPES,
  type SanitizedTraits,
  type SoftTraits,
} from './matcher.ts';

interface StoredTraits {
  /** Hashed identifiers by type. */
  ids: Record<string, string>;
  soft: SoftTraits;
}

interface DeviceRow {
  id: string;
  workspace_id: string;
  traits_json: string;
  trial_claimed: number;
  trial_account_id: string | null;
  claimed_at: number | null;
  blocked: number;
  block_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface MatchOutcome {
  nodeId: string;
  isNew: boolean;
  score: number;
  deterministic: boolean;
  matchedOn: string | null;
  blocked: boolean;
  blockReason: string | null;
}

const FUZZY_CANDIDATE_LIMIT = 50;

function parseTraits(json: string): StoredTraits {
  try {
    const t = JSON.parse(json) as Partial<StoredTraits>;
    return { ids: t.ids ?? {}, soft: t.soft ?? {} };
  } catch {
    return { ids: {}, soft: {} };
  }
}

/** Identifiers are hashed per workspace, so they cannot be correlated across tenants. */
async function hashIds(workspaceId: string, ids: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [type, value] of Object.entries(ids)) {
    out[type] = await sha256Hex(`${workspaceId}:${type}:${value}`);
  }
  return out;
}

async function getDevice(env: Env, workspaceId: string, nodeId: string): Promise<DeviceRow | null> {
  return env.DB.prepare('SELECT * FROM device_nodes WHERE id = ? AND workspace_id = ?')
    .bind(nodeId, workspaceId)
    .first<DeviceRow>();
}

/**
 * Finds the device these traits belong to, or registers a new one, then links
 * the account to it.
 */
export async function checkAndRegister(
  env: Env,
  ws: Workspace,
  traits: SanitizedTraits,
  accountId: string,
  now: number,
): Promise<MatchOutcome> {
  const hashed = await hashIds(ws.id, traits.ids);
  const idTypes = ID_TYPES.filter((t) => hashed[t]);

  let node: DeviceRow | null = null;
  let deterministic = false;
  let matchedOn: string | null = null;
  let score = 0;
  let isNew = false;

  // 1. Exact identifier lookup, in priority order.
  if (idTypes.length > 0) {
    const conditions = idTypes.map(() => '(id_type = ? AND id_hash = ?)').join(' OR ');
    const params = idTypes.flatMap((t) => [t, hashed[t]]);
    const { results } = await env.DB.prepare(
      `SELECT id_type, node_id FROM device_ids WHERE workspace_id = ? AND (${conditions})`,
    )
      .bind(ws.id, ...params)
      .all<{ id_type: string; node_id: string }>();

    for (const type of idTypes) {
      const hit = results.find((r) => r.id_type === type);
      if (!hit) continue;
      node = await getDevice(env, ws.id, hit.node_id);
      if (node) {
        deterministic = true;
        matchedOn = type;
        score = 1;
        break;
      }
    }
  }

  // 2. Fingerprint similarity, for devices that lost or never had an identifier.
  if (!node && canFuzzyMatch(traits.soft)) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM device_nodes
        WHERE workspace_id = ? AND (canvas_hash = ? OR webgl_hash = ?)
        ORDER BY updated_at DESC LIMIT ?`,
    )
      .bind(ws.id, traits.soft.canvas_hash ?? '', traits.soft.webgl_hash ?? '', FUZZY_CANDIDATE_LIMIT)
      .all<DeviceRow>();

    let best: DeviceRow | null = null;
    for (const candidate of results) {
      const stored = parseTraits(candidate.traits_json);
      if (hasHardIdConflict(hashed, stored.ids)) continue;
      const s = calculateSimilarity(traits.soft, stored.soft);
      if (s > score) {
        score = s;
        best = candidate;
      }
    }
    if (best && score >= ws.match_threshold) {
      node = best;
      matchedOn = 'fingerprint';
    }
  }

  // 3. Unknown device: register it.
  if (!node) {
    const id = `dev_${randomHex(12)}`;
    const stored: StoredTraits = { ids: hashed, soft: traits.soft };
    await env.DB.prepare(
      `INSERT INTO device_nodes
         (id, workspace_id, os_platform, canvas_hash, webgl_hash, traits_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        ws.id,
        traits.soft.os_platform ?? null,
        traits.soft.canvas_hash ?? null,
        traits.soft.webgl_hash ?? null,
        JSON.stringify(stored),
        now,
        now,
      )
      .run();
    isNew = true;
    node = await getDevice(env, ws.id, id);
    if (!node) throw new HttpError(500, 'internal_error', 'Device registration failed');
  } else {
    // Remember identifiers and traits this device had not reported before.
    const stored = parseTraits(node.traits_json);
    const merged: StoredTraits = {
      ids: { ...hashed, ...stored.ids },
      soft: { ...traits.soft, ...stored.soft },
    };
    await env.DB.prepare(
      `UPDATE device_nodes
          SET traits_json = ?, updated_at = ?,
              canvas_hash = COALESCE(canvas_hash, ?), webgl_hash = COALESCE(webgl_hash, ?),
              os_platform = COALESCE(os_platform, ?)
        WHERE id = ?`,
    )
      .bind(
        JSON.stringify(merged),
        now,
        traits.soft.canvas_hash ?? null,
        traits.soft.webgl_hash ?? null,
        traits.soft.os_platform ?? null,
        node.id,
      )
      .run();
  }

  // Index identifiers. OR IGNORE keeps an identifier with the device that claimed it first.
  if (idTypes.length > 0) {
    await env.DB.batch(
      idTypes.map((t) =>
        env.DB.prepare(
          'INSERT OR IGNORE INTO device_ids (workspace_id, id_type, id_hash, node_id) VALUES (?, ?, ?, ?)',
        ).bind(ws.id, t, hashed[t], node!.id),
      ),
    );

    // Two simultaneous first requests from one device can each register it.
    // Whichever indexed its identifier first wins; the duplicate is removed.
    if (isNew) {
      const owner = await env.DB.prepare(
        'SELECT node_id FROM device_ids WHERE workspace_id = ? AND id_type = ? AND id_hash = ?',
      )
        .bind(ws.id, idTypes[0], hashed[idTypes[0]])
        .first<{ node_id: string }>();
      if (owner && owner.node_id !== node.id) {
        const winner = await getDevice(env, ws.id, owner.node_id);
        if (winner) {
          await env.DB.prepare('DELETE FROM device_nodes WHERE id = ?').bind(node.id).run();
          node = winner;
          isNew = false;
          deterministic = true;
          matchedOn = idTypes[0];
          score = 1;
        }
      }
    }
  }

  await env.DB.prepare(
    'INSERT OR IGNORE INTO account_links (node_id, account_id, linked_at) VALUES (?, ?, ?)',
  )
    .bind(node.id, accountId, now)
    .run();

  return {
    nodeId: node.id,
    isNew,
    score,
    deterministic,
    matchedOn,
    blocked: node.blocked === 1,
    blockReason: node.block_reason,
  };
}

export type TrialOutcome = 'granted' | 'owner' | 'reused';

/**
 * Claims the device's free trial for an account. The conditional UPDATE makes
 * the claim atomic: of two racing accounts, exactly one gets it.
 */
export async function claimTrial(
  env: Env,
  nodeId: string,
  accountId: string,
  now: number,
): Promise<TrialOutcome> {
  const res = await env.DB.prepare(
    `UPDATE device_nodes SET trial_claimed = 1, trial_account_id = ?, claimed_at = ?, updated_at = ?
      WHERE id = ? AND trial_claimed = 0`,
  )
    .bind(accountId, now, now, nodeId)
    .run();
  if (res.meta.changes === 1) return 'granted';

  const row = await env.DB.prepare('SELECT trial_account_id FROM device_nodes WHERE id = ?')
    .bind(nodeId)
    .first<{ trial_account_id: string | null }>();
  return row?.trial_account_id === accountId ? 'owner' : 'reused';
}

export interface DeviceView {
  id: string;
  traits: SoftTraits;
  identifier_types: string[];
  associated_accounts: string[];
  trial_claimed: boolean;
  trial_account_id: string | null;
  claimed_at: string | null;
  blocked: boolean;
  block_reason: string | null;
  created_at: string;
  updated_at: string;
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

function toView(row: DeviceRow, accounts: string[]): DeviceView {
  const stored = parseTraits(row.traits_json);
  return {
    id: row.id,
    traits: stored.soft,
    identifier_types: Object.keys(stored.ids),
    associated_accounts: accounts,
    trial_claimed: row.trial_claimed === 1,
    trial_account_id: row.trial_account_id,
    claimed_at: iso(row.claimed_at),
    blocked: row.blocked === 1,
    block_reason: row.block_reason,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  };
}

async function accountsFor(env: Env, nodeIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (nodeIds.length === 0) return map;
  const placeholders = nodeIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT node_id, account_id FROM account_links WHERE node_id IN (${placeholders}) ORDER BY linked_at`,
  )
    .bind(...nodeIds)
    .all<{ node_id: string; account_id: string }>();
  for (const r of results) {
    const list = map.get(r.node_id) ?? [];
    list.push(r.account_id);
    map.set(r.node_id, list);
  }
  return map;
}

export async function listDevices(
  env: Env,
  workspaceId: string,
  limit: number,
  before: number | null,
): Promise<{ devices: DeviceView[]; next_before: number | null }> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM device_nodes
      WHERE workspace_id = ? AND updated_at < ?
      ORDER BY updated_at DESC LIMIT ?`,
  )
    .bind(workspaceId, before ?? Number.MAX_SAFE_INTEGER, limit)
    .all<DeviceRow>();
  const accounts = await accountsFor(env, results.map((r) => r.id));
  return {
    devices: results.map((r) => toView(r, accounts.get(r.id) ?? [])),
    next_before: results.length === limit ? results[results.length - 1].updated_at : null,
  };
}

export async function getDeviceView(env: Env, workspaceId: string, nodeId: string): Promise<DeviceView> {
  const row = await getDevice(env, workspaceId, nodeId);
  if (!row) throw new HttpError(404, 'device_not_found', 'No device with that ID in this workspace');
  const accounts = await accountsFor(env, [row.id]);
  return toView(row, accounts.get(row.id) ?? []);
}

export async function setOverride(
  env: Env,
  workspaceId: string,
  nodeId: string,
  blocked: boolean,
  reason: string,
): Promise<DeviceView> {
  const res = await env.DB.prepare(
    'UPDATE device_nodes SET blocked = ?, block_reason = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
  )
    .bind(blocked ? 1 : 0, blocked ? reason : null, Date.now(), nodeId, workspaceId)
    .run();
  if (res.meta.changes !== 1) {
    throw new HttpError(404, 'device_not_found', 'No device with that ID in this workspace');
  }
  return getDeviceView(env, workspaceId, nodeId);
}

/** Clears a device's trial claim, for support cases where a block was wrong. */
export async function resetTrial(env: Env, workspaceId: string, nodeId: string): Promise<DeviceView> {
  const res = await env.DB.prepare(
    `UPDATE device_nodes SET trial_claimed = 0, trial_account_id = NULL, claimed_at = NULL, updated_at = ?
      WHERE id = ? AND workspace_id = ?`,
  )
    .bind(Date.now(), nodeId, workspaceId)
    .run();
  if (res.meta.changes !== 1) {
    throw new HttpError(404, 'device_not_found', 'No device with that ID in this workspace');
  }
  return getDeviceView(env, workspaceId, nodeId);
}
