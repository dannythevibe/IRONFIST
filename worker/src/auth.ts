// Authentication: API keys for the public API, cookie sessions for the console.

import { newId, randomHex, sha256Hex } from './crypto.ts';
import { HttpError, type Env, type Workspace } from './http.ts';

export type KeyKind = 'publishable' | 'secret';

export interface ApiKeyContext {
  keyId: string;
  kind: KeyKind;
  workspace: Workspace;
}

const KEY_PREFIX: Record<KeyKind, string> = {
  publishable: 'if_pk_',
  secret: 'if_sk_',
};

export function generateApiKey(kind: KeyKind): { key: string; display: string } {
  const key = KEY_PREFIX[kind] + randomHex(20);
  return { key, display: `${key.slice(0, 10)}…${key.slice(-4)}` };
}

export async function createApiKey(
  env: Env,
  workspaceId: string,
  kind: KeyKind,
  name: string,
  now: number,
): Promise<{ id: string; key: string; display: string; kind: KeyKind; name: string; created_at: number }> {
  const { key, display } = generateApiKey(kind);
  const id = newId('key');
  await env.DB.prepare(
    'INSERT INTO api_keys (id, workspace_id, kind, name, key_hash, display, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, workspaceId, kind, name, await sha256Hex(key), display, now)
    .run();
  return { id, key, display, kind, name, created_at: now };
}

function extractKey(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const header = request.headers.get('X-IronFist-Key');
  return header ? header.trim() : null;
}

const LAST_USED_GRANULARITY_MS = 60 * 60 * 1000;

/**
 * Resolves the API key on a request. Pass `requireSecret` for anything that
 * reads or changes workspace data: publishable keys ship inside client apps,
 * so they may only submit verifications.
 */
export async function authenticateApiKey(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  requireSecret: boolean,
): Promise<ApiKeyContext> {
  const key = extractKey(request);
  if (!key) {
    throw new HttpError(
      401,
      'missing_api_key',
      'Provide an API key in the Authorization header: "Authorization: Bearer <key>"',
    );
  }
  if (!key.startsWith('if_pk_') && !key.startsWith('if_sk_')) {
    throw new HttpError(401, 'invalid_api_key', 'API key is not valid');
  }

  const row = await env.DB.prepare(
    `SELECT k.id AS key_id, k.kind, k.revoked_at, k.last_used_at,
            w.id, w.owner_id, w.name, w.tb_capacity, w.tb_refill_rate, w.match_threshold, w.created_at
       FROM api_keys k JOIN workspaces w ON w.id = k.workspace_id
      WHERE k.key_hash = ?`,
  )
    .bind(await sha256Hex(key))
    .first<Record<string, unknown>>();

  if (!row || row.revoked_at !== null) {
    throw new HttpError(401, 'invalid_api_key', 'API key is not valid or has been revoked');
  }
  const kind = row.kind as KeyKind;
  if (requireSecret && kind !== 'secret') {
    throw new HttpError(
      403,
      'secret_key_required',
      'This endpoint requires a secret key (if_sk_…). Publishable keys can only submit verifications.',
    );
  }

  const now = Date.now();
  const lastUsed = row.last_used_at as number | null;
  if (lastUsed === null || now - lastUsed > LAST_USED_GRANULARITY_MS) {
    ctx.waitUntil(
      env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').bind(now, row.key_id).run(),
    );
  }

  return {
    keyId: row.key_id as string,
    kind,
    workspace: {
      id: row.id as string,
      owner_id: row.owner_id as string,
      name: row.name as string,
      tb_capacity: row.tb_capacity as number,
      tb_refill_rate: row.tb_refill_rate as number,
      match_threshold: row.match_threshold as number,
      created_at: row.created_at as number,
    },
  };
}

// ---------------------------------------------------------------- sessions

const SESSION_COOKIE = 'if_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
}

export async function createSession(env: Env, userId: string, now: number): Promise<string> {
  const token = randomHex(32);
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256Hex(token), userId, now + SESSION_TTL_MS, now)
    .run();
  return token;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      const value = rest.join('=');
      return /^[0-9a-f]{64}$/.test(value) ? value : null;
    }
  }
  return null;
}

export async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
  )
    .bind(await sha256Hex(token))
    .first<{ id: string; email: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, email: row.email };
}

export async function requireSessionUser(request: Request, env: Env): Promise<SessionUser> {
  const user = await getSessionUser(request, env);
  if (!user) throw new HttpError(401, 'not_signed_in', 'Sign in to continue');
  return user;
}

export async function destroySession(request: Request, env: Env): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(await sha256Hex(token))
    .run();
}

/**
 * Cross-site request forgery guard for cookie-authenticated routes: a browser
 * always sends Origin on cross-site state-changing requests, so a mismatch
 * means the request did not come from the console.
 */
export function assertSameOrigin(request: Request): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, 'cross_origin_blocked', 'Cross-origin requests are not allowed');
  }
}
