// Console endpoints under /api, authenticated by the session cookie.

import {
  assertSameOrigin,
  clearSessionCookie,
  createApiKey,
  createSession,
  destroySession,
  requireSessionUser,
  sessionCookie,
  type KeyKind,
  type SessionUser,
} from './auth.ts';
import { validateBucketParams } from './bucket.ts';
import { DEFAULT_PBKDF2_ITERATIONS, hashPassword, newId, verifyPassword } from './crypto.ts';
import { getDeviceView, listDevices, resetTrial, setOverride } from './devices.ts';
import { clampInt, clientIp, HttpError, json, readJson, type Env, type Workspace } from './http.ts';
import { parseOverride } from './publicapi.ts';
import { checkBucket, enforceLimit, rateLimitHeaders, resetBucket } from './ratelimit.ts';
import { listVerifications, networkFromRequest, runVerification, workspaceStats } from './verify.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;
const MAX_WORKSPACES = 10;
const MAX_ACTIVE_KEYS = 20;

function iterations(env: Env): number {
  const n = Number(env.PBKDF2_ITERATIONS);
  return Number.isInteger(n) && n >= 10_000 && n <= 100_000 ? n : DEFAULT_PBKDF2_ITERATIONS;
}

function workspaceView(w: Workspace) {
  return {
    id: w.id,
    name: w.name,
    tb_capacity: w.tb_capacity,
    tb_refill_rate: w.tb_refill_rate,
    match_threshold: w.match_threshold,
    created_at: new Date(w.created_at).toISOString(),
  };
}

async function listWorkspaces(env: Env, userId: string): Promise<Workspace[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at',
  )
    .bind(userId)
    .all<Workspace>();
  return results;
}

async function ownedWorkspace(env: Env, user: SessionUser, id: string): Promise<Workspace> {
  const ws = await env.DB.prepare('SELECT * FROM workspaces WHERE id = ? AND owner_id = ?')
    .bind(id, user.id)
    .first<Workspace>();
  if (!ws) throw new HttpError(404, 'workspace_not_found', 'Workspace not found');
  return ws;
}

async function createWorkspace(env: Env, userId: string, name: string, now: number): Promise<Workspace> {
  const ws: Workspace = {
    id: newId('ws'),
    owner_id: userId,
    name,
    tb_capacity: 100,
    tb_refill_rate: 5,
    match_threshold: 0.88,
    created_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO workspaces (id, owner_id, name, tb_capacity, tb_refill_rate, match_threshold, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(ws.id, ws.owner_id, ws.name, ws.tb_capacity, ws.tb_refill_rate, ws.match_threshold, ws.created_at)
    .run();
  return ws;
}

function cleanName(value: unknown, fallback: string): string {
  const s = typeof value === 'string' ? value.trim().slice(0, 80) : '';
  return s || fallback;
}

async function signup(request: Request, env: Env): Promise<Response> {
  await enforceLimit(env, `auth:${clientIp(request)}`, 10, 10 / 60);
  const body = await readJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new HttpError(400, 'invalid_email', 'Enter a valid email address');
  }
  if (password.length < MIN_PASSWORD || password.length > 200) {
    throw new HttpError(400, 'weak_password', `Password must be at least ${MIN_PASSWORD} characters`);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) throw new HttpError(409, 'email_taken', 'An account with that email already exists');

  const now = Date.now();
  const userId = newId('usr');
  try {
    await env.DB.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(userId, email, await hashPassword(password, iterations(env)), now)
      .run();
  } catch {
    throw new HttpError(409, 'email_taken', 'An account with that email already exists');
  }

  const ws = await createWorkspace(env, userId, 'My App', now);
  const publishable = await createApiKey(env, ws.id, 'publishable', 'Default publishable key', now);
  const secret = await createApiKey(env, ws.id, 'secret', 'Default secret key', now);
  const token = await createSession(env, userId, now);

  return json(
    {
      user: { id: userId, email },
      workspace: workspaceView(ws),
      // Shown once: only hashes are stored.
      keys: { publishable: publishable.key, secret: secret.key },
    },
    201,
    { 'Set-Cookie': sessionCookie(token) },
  );
}

async function login(request: Request, env: Env): Promise<Response> {
  await enforceLimit(env, `auth:${clientIp(request)}`, 10, 10 / 60);
  const body = await readJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const user = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();
  const ok = user ? await verifyPassword(password.slice(0, 200), user.password_hash) : false;
  if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'Incorrect email or password');

  const token = await createSession(env, user.id, Date.now());
  return json({ user: { id: user.id, email: user.email } }, 200, { 'Set-Cookie': sessionCookie(token) });
}

export async function handleConsoleApi(
  request: Request,
  env: Env,
  path: string,
  url: URL,
): Promise<Response> {
  const method = request.method;
  assertSameOrigin(request);

  if (path === '/api/auth/signup' && method === 'POST') return signup(request, env);
  if (path === '/api/auth/login' && method === 'POST') return login(request, env);
  if (path === '/api/auth/logout' && method === 'POST') {
    await destroySession(request, env);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  const user = await requireSessionUser(request, env);

  if (path === '/api/me' && method === 'GET') {
    const workspaces = await listWorkspaces(env, user.id);
    return json({ user, workspaces: workspaces.map(workspaceView) });
  }

  if (path === '/api/workspaces' && method === 'POST') {
    const body = await readJson(request);
    const existing = await listWorkspaces(env, user.id);
    if (existing.length >= MAX_WORKSPACES) {
      throw new HttpError(400, 'workspace_limit', `You can have at most ${MAX_WORKSPACES} workspaces`);
    }
    const ws = await createWorkspace(env, user.id, cleanName(body.name, 'New Workspace'), Date.now());
    return json(workspaceView(ws), 201);
  }

  const m = path.match(/^\/api\/workspaces\/([\w-]+)(\/.*)?$/);
  if (!m) throw new HttpError(404, 'not_found', `No such endpoint: ${method} ${path}`);
  const ws = await ownedWorkspace(env, user, m[1]);
  const sub = m[2] ?? '';

  if (sub === '' && method === 'PATCH') {
    const body = await readJson(request);
    const name = body.name === undefined ? ws.name : cleanName(body.name, ws.name);
    const capacity = body.tb_capacity === undefined ? ws.tb_capacity : Number(body.tb_capacity);
    const refill = body.tb_refill_rate === undefined ? ws.tb_refill_rate : Number(body.tb_refill_rate);
    const threshold = body.match_threshold === undefined ? ws.match_threshold : Number(body.match_threshold);
    const problem = validateBucketParams(capacity, refill, 1);
    if (problem) throw new HttpError(400, 'invalid_bucket_params', problem);
    if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) {
      throw new HttpError(400, 'invalid_threshold', 'match_threshold must be between 0.5 and 1');
    }
    await env.DB.prepare(
      'UPDATE workspaces SET name = ?, tb_capacity = ?, tb_refill_rate = ?, match_threshold = ? WHERE id = ?',
    )
      .bind(name, capacity, refill, threshold, ws.id)
      .run();
    return json(
      workspaceView({ ...ws, name, tb_capacity: capacity, tb_refill_rate: refill, match_threshold: threshold }),
    );
  }

  if (sub === '/stats' && method === 'GET') {
    return json(await workspaceStats(env, ws.id));
  }

  if (sub === '/keys' && method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, kind, name, display, created_at, last_used_at, revoked_at
         FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC`,
    )
      .bind(ws.id)
      .all<Record<string, unknown>>();
    const iso = (v: unknown) => (typeof v === 'number' ? new Date(v).toISOString() : null);
    return json({
      keys: results.map((k) => ({
        id: k.id,
        kind: k.kind,
        name: k.name,
        display: k.display,
        created_at: iso(k.created_at),
        last_used_at: iso(k.last_used_at),
        revoked_at: iso(k.revoked_at),
      })),
    });
  }

  if (sub === '/keys' && method === 'POST') {
    const body = await readJson(request);
    const kind = body.kind as KeyKind;
    if (kind !== 'publishable' && kind !== 'secret') {
      throw new HttpError(400, 'invalid_kind', 'kind must be "publishable" or "secret"');
    }
    const active = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL',
    )
      .bind(ws.id)
      .first<{ n: number }>();
    if ((active?.n ?? 0) >= MAX_ACTIVE_KEYS) {
      throw new HttpError(400, 'key_limit', `A workspace can have at most ${MAX_ACTIVE_KEYS} active keys`);
    }
    const created = await createApiKey(
      env,
      ws.id,
      kind,
      cleanName(body.name, kind === 'secret' ? 'Secret key' : 'Publishable key'),
      Date.now(),
    );
    return json({ ...created, created_at: new Date(created.created_at).toISOString() }, 201);
  }

  let k = sub.match(/^\/keys\/([\w-]+)$/);
  if (k && method === 'DELETE') {
    const res = await env.DB.prepare(
      'UPDATE api_keys SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL',
    )
      .bind(Date.now(), k[1], ws.id)
      .run();
    if (res.meta.changes !== 1) throw new HttpError(404, 'key_not_found', 'No active key with that ID');
    return json({ ok: true });
  }

  if (sub === '/devices' && method === 'GET') {
    const limit = clampInt(url.searchParams.get('limit'), 100, 1, 200);
    return json(await listDevices(env, ws.id, limit, null));
  }

  k = sub.match(/^\/devices\/([\w-]+)$/);
  if (k && method === 'GET') return json(await getDeviceView(env, ws.id, k[1]));

  k = sub.match(/^\/devices\/([\w-]+)\/override$/);
  if (k && method === 'POST') {
    const { blocked, reason } = parseOverride(await readJson(request));
    return json(await setOverride(env, ws.id, k[1], blocked, reason));
  }

  k = sub.match(/^\/devices\/([\w-]+)\/reset-trial$/);
  if (k && method === 'POST') return json(await resetTrial(env, ws.id, k[1]));

  if (sub === '/logs' && method === 'GET') {
    const limit = clampInt(url.searchParams.get('limit'), 100, 1, 200);
    return json({ verifications: await listVerifications(env, ws.id, limit) });
  }

  // Runs a real verification from the console, as this browser, without an API key.
  if (sub === '/simulate' && method === 'POST') {
    const limit = await checkBucket(env, `verify:${ws.id}`, ws.tb_capacity, ws.tb_refill_rate, 1);
    if (!limit.allowed) {
      return json(
        { decision: 'RATE_LIMITED', allowed: false, reason: 'Workspace verification rate limit exceeded', rate_limit: limit },
        429,
        rateLimitHeaders(limit),
      );
    }
    const body = await readJson(request);
    const result = await runVerification(env, ws, body as never, networkFromRequest(request), limit, 'console');
    return json(result);
  }

  // Exercises a scratch bucket that uses the workspace's limits.
  if (sub === '/token-bucket/test' && method === 'POST') {
    const body = await readJson(request);
    const requested = body.requested === undefined ? 1 : Number(body.requested);
    const problem = validateBucketParams(ws.tb_capacity, ws.tb_refill_rate, requested);
    if (problem) throw new HttpError(400, 'invalid_bucket_params', problem);
    const name = `test:${ws.id}`;
    if (body.reset === true) await resetBucket(env, name);
    // A zero-cost peek is not possible with requested > 0, so reset returns a full bucket.
    const result = body.reset === true
      ? { allowed: true, remaining: ws.tb_capacity, capacity: ws.tb_capacity, refill_rate: ws.tb_refill_rate, retry_after: 0 }
      : await checkBucket(env, name, ws.tb_capacity, ws.tb_refill_rate, requested);
    return json(result);
  }

  throw new HttpError(404, 'not_found', `No such endpoint: ${method} ${path}`);
}
