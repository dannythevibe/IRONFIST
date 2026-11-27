// Shared types and small HTTP helpers.

import type { TokenBucket } from './ratelimit.ts';

export interface Env {
  DB: D1Database;
  BUCKETS: DurableObjectNamespace<TokenBucket>;
  ASSETS: Fetcher;
  /** Optional override for password hashing cost (max 100000 on Workers). */
  PBKDF2_ITERATIONS?: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  tb_capacity: number;
  tb_refill_rate: number;
  match_threshold: number;
  created_at: number;
}

/** An error that maps directly to an HTTP response. */
export class HttpError extends Error {
  status: number;
  code: string;
  headers: Record<string, string>;

  constructor(status: number, code: string, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorResponse(err: HttpError): Response {
  return json({ error: { code: err.code, message: err.message } }, err.status, err.headers);
}

const MAX_BODY_BYTES = 64 * 1024;

/** Reads a JSON object body, rejecting anything oversized or malformed. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', 'Request body is too large');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'invalid_json', 'Request body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? '';
}

export function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = value === null ? NaN : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
