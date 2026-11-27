// IronFist on Cloudflare Workers.
//
//   /v1/*   public API, authenticated by API key (CORS open, for client SDKs)
//   /api/*  console API, authenticated by session cookie (same origin only)
//   /mcp    Model Context Protocol endpoint for AI agents
//   *       the console and landing page, served from static assets

import { handleConsoleApi } from './console.ts';
import { errorResponse, HttpError, json, type Env } from './http.ts';
import { handleMcp } from './mcp.ts';
import { handlePublicApi } from './publicapi.ts';

export { TokenBucket } from './ratelimit.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-IronFist-Key',
  'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining',
  'Access-Control-Max-Age': '86400',
};

function withCors(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS_HEADERS)) out.headers.set(k, v);
  return out;
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

  if (path === '/health') {
    return json({ status: 'ok', service: 'ironfist', version: '3.0.0' });
  }

  if (path.startsWith('/v1/')) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    try {
      return withCors(await handlePublicApi(request, env, ctx, path, url));
    } catch (err) {
      if (err instanceof HttpError) return withCors(errorResponse(err));
      throw err;
    }
  }

  if (path.startsWith('/api/')) return handleConsoleApi(request, env, path, url);
  if (path === '/mcp') return handleMcp(request, env, ctx);

  return env.ASSETS.fetch(request);
}

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err);
      console.error('unhandled error', err);
      return json({ error: { code: 'internal_error', message: 'Internal server error' } }, 500);
    }
  },

  // Daily cleanup: expired sessions and verification logs past retention.
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM verifications WHERE created_at < ?').bind(now - RETENTION_MS),
    ]);
  },
} satisfies ExportedHandler<Env>;
