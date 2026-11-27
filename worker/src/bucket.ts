// Token bucket arithmetic. Pure, so it can be unit-tested with plain Node.

export interface BucketState {
  tokens: number;
  updatedMs: number;
}

export interface BucketResult {
  allowed: boolean;
  remaining: number;
  capacity: number;
  refill_rate: number;
  /** Seconds until the request would fit. 0 when allowed, null if it never will. */
  retry_after: number | null;
}

export function takeTokens(
  prev: BucketState | null,
  capacity: number,
  refillRate: number,
  requested: number,
  nowMs: number,
): { state: BucketState; result: BucketResult } {
  let tokens = capacity;
  if (prev) {
    const elapsedSec = Math.max(0, nowMs - prev.updatedMs) / 1000;
    // Clamp to capacity so lowering a limit takes effect immediately.
    tokens = Math.min(capacity, prev.tokens + elapsedSec * refillRate);
  }

  const allowed = tokens >= requested;
  if (allowed) tokens -= requested;

  let retryAfter: number | null = 0;
  if (!allowed) {
    if (requested > capacity || refillRate <= 0) retryAfter = null;
    else retryAfter = Math.ceil(((requested - tokens) / refillRate) * 100) / 100;
  }

  return {
    state: { tokens, updatedMs: nowMs },
    result: {
      allowed,
      remaining: Math.floor(tokens * 100) / 100,
      capacity,
      refill_rate: refillRate,
      retry_after: retryAfter,
    },
  };
}

export const BUCKET_LIMITS = {
  maxCapacity: 1_000_000,
  maxRefillRate: 100_000,
};

/** Validates caller-supplied bucket parameters. Returns an error message or null. */
export function validateBucketParams(
  capacity: number,
  refillRate: number,
  requested: number,
): string | null {
  if (!Number.isFinite(capacity) || capacity <= 0 || capacity > BUCKET_LIMITS.maxCapacity) {
    return `capacity must be a number between 0 and ${BUCKET_LIMITS.maxCapacity}`;
  }
  if (!Number.isFinite(refillRate) || refillRate < 0 || refillRate > BUCKET_LIMITS.maxRefillRate) {
    return `refill_rate must be a number between 0 and ${BUCKET_LIMITS.maxRefillRate}`;
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return 'requested must be a positive number';
  }
  return null;
}
