// Public, API-key-authenticated endpoints under /v1.

import { authenticateApiKey } from './auth.ts';
import { validateBucketParams, type BucketResult } from './bucket.ts';
import { getDeviceView, listDevices, resetTrial, setOverride } from './devices.ts';
import { clampInt, HttpError, json, readJson, type Env, type Workspace } from './http.ts';
import { checkBucket, enforceLimit, rateLimitHeaders } from './ratelimit.ts';
import { getVerification, listVerifications, networkFromRequest, runVerification } from './verify.ts';

/** Budget for management calls (devices, logs, overrides) per workspace. */
const MANAGEMENT_CAPACITY = 300;
const MANAGEMENT_REFILL = 20;

/** Developer-facing rate limiter: one named bucket per key inside the workspace. */
export async function checkDeveloperBucket(
  env: Env,
  ws: Workspace,
  body: Record<string, unknown>,
): Promise<BucketResult> {
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key || key.length > 128) {
    throw new HttpError(400, 'invalid_key', 'key is required (string, 1-128 characters)');
  }
  const capacity = body.capacity === undefined ? ws.tb_capacity : Number(body.capacity);
  const refill = body.refill_rate === undefined ? ws.tb_refill_rate : Number(body.refill_rate);
  const requested = body.requested === undefined ? 1 : Number(body.requested);
  const problem = validateBucketParams(capacity, refill, requested);
  if (problem) throw new HttpError(400, 'invalid_bucket_params', problem);
  return checkBucket(env, `tb:${ws.id}:${key}`, capacity, refill, requested);
}

export function parseOverride(body: Record<string, unknown>): { blocked: boolean; reason: string } {
  if (typeof body.blocked !== 'boolean') {
    throw new HttpError(400, 'invalid_override', 'blocked is required (boolean)');
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (body.blocked && !reason) {
    throw new HttpError(400, 'invalid_override', 'reason is required when blocking a device');
  }
  return { blocked: body.blocked, reason };
}

export async function handlePublicApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  url: URL,
): Promise<Response> {
  const method = request.method;

  // ---- Verification: publishable or secret key.
  if (path === '/v1/verify' || path === '/v1/verify-trial') {
    if (method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST');
    const auth = await authenticateApiKey(request, env, ctx, false);
    const ws = auth.workspace;
    const limit = await checkBucket(env, `verify:${ws.id}`, ws.tb_capacity, ws.tb_refill_rate, 1);
    if (!limit.allowed) {
      return json(
        {
          decision: 'RATE_LIMITED',
          allowed: false,
          reason: 'Workspace verification rate limit exceeded',
          rate_limit: limit,
        },
        429,
        rateLimitHeaders(limit),
      );
    }
    const body = await readJson(request);
    // A publishable key means the end user's device is calling, so its
    // connection is the one worth inspecting.
    const network = auth.kind === 'publishable' ? networkFromRequest(request) : null;
    const result = await runVerification(
      env,
      ws,
      body as never,
      network,
      limit,
      auth.kind === 'publishable' ? 'client' : 'server',
    );
    return json(result, 200, rateLimitHeaders(limit));
  }

  // ---- Everything else needs a secret key.
  const auth = await authenticateApiKey(request, env, ctx, true);
  const ws = auth.workspace;
  await enforceLimit(env, `api:${ws.id}`, MANAGEMENT_CAPACITY, MANAGEMENT_REFILL);

  if (path === '/v1/verifications' && method === 'GET') {
    const limit = clampInt(url.searchParams.get('limit'), 50, 1, 200);
    return json({ verifications: await listVerifications(env, ws.id, limit) });
  }

  let m = path.match(/^\/v1\/verifications\/([\w-]+)$/);
  if (m && method === 'GET') {
    return json(await getVerification(env, ws.id, m[1]));
  }

  if (path === '/v1/devices' && method === 'GET') {
    const limit = clampInt(url.searchParams.get('limit'), 50, 1, 200);
    const beforeRaw = url.searchParams.get('before');
    const before = beforeRaw ? Number(beforeRaw) : null;
    return json(await listDevices(env, ws.id, limit, Number.isFinite(before) ? before : null));
  }

  m = path.match(/^\/v1\/devices\/([\w-]+)$/);
  if (m && method === 'GET') {
    return json(await getDeviceView(env, ws.id, m[1]));
  }

  m = path.match(/^\/v1\/devices\/([\w-]+)\/override$/);
  if (m && method === 'POST') {
    const { blocked, reason } = parseOverride(await readJson(request));
    return json(await setOverride(env, ws.id, m[1], blocked, reason));
  }

  m = path.match(/^\/v1\/devices\/([\w-]+)\/reset-trial$/);
  if (m && method === 'POST') {
    return json(await resetTrial(env, ws.id, m[1]));
  }

  if (path === '/v1/token-bucket/check' && method === 'POST') {
    const result = await checkDeveloperBucket(env, ws, await readJson(request));
    return json(result, result.allowed ? 200 : 429, rateLimitHeaders(result));
  }

  throw new HttpError(404, 'not_found', `No such endpoint: ${method} ${path}`);
}
