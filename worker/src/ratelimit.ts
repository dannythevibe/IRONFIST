// Durable Object holding one token bucket. A Durable Object processes its
// calls one at a time, which is what makes each check atomic without Redis.

import { DurableObject } from 'cloudflare:workers';
import { takeTokens, type BucketResult, type BucketState } from './bucket.ts';
import { HttpError, type Env } from './http.ts';

export class TokenBucket extends DurableObject<Env> {
  private state: BucketState | null = null;
  private loaded = false;

  async check(capacity: number, refillRate: number, requested: number): Promise<BucketResult> {
    if (!this.loaded) {
      this.state = (await this.ctx.storage.get<BucketState>('state')) ?? null;
      this.loaded = true;
    }
    const { state, result } = takeTokens(this.state, capacity, refillRate, requested, Date.now());
    this.state = state;
    // Not awaited: the runtime holds the response until the write is durable.
    void this.ctx.storage.put('state', state);
    return result;
  }

  async reset(): Promise<void> {
    this.state = null;
    this.loaded = true;
    await this.ctx.storage.deleteAll();
  }
}

export async function checkBucket(
  env: Env,
  name: string,
  capacity: number,
  refillRate: number,
  requested = 1,
): Promise<BucketResult> {
  const stub = env.BUCKETS.get(env.BUCKETS.idFromName(name));
  return stub.check(capacity, refillRate, requested);
}

export async function resetBucket(env: Env, name: string): Promise<void> {
  const stub = env.BUCKETS.get(env.BUCKETS.idFromName(name));
  await stub.reset();
}

export function rateLimitHeaders(r: BucketResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(r.capacity),
    'X-RateLimit-Remaining': String(Math.floor(r.remaining)),
  };
  if (!r.allowed && r.retry_after !== null) headers['Retry-After'] = String(Math.ceil(r.retry_after));
  return headers;
}

/** Throws a 429 when the named bucket is empty. */
export async function enforceLimit(
  env: Env,
  name: string,
  capacity: number,
  refillRate: number,
): Promise<BucketResult> {
  const result = await checkBucket(env, name, capacity, refillRate, 1);
  if (!result.allowed) {
    throw new HttpError(429, 'rate_limited', 'Too many requests', rateLimitHeaders(result));
  }
  return result;
}
