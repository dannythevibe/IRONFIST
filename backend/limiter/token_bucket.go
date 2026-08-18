package limiter

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// TokenBucketResult represents the outcome of a rate-limit check.
type TokenBucketResult struct {
	Allowed   bool    `json:"allowed"`
	Remaining float64 `json:"remaining"`
	Capacity  float64 `json:"capacity"`
	RefillRate float64 `json:"refill_rate"`
}

// TokenBucketLimiter manages atomic token bucket rate limiting via Redis Lua scripts or in-memory fallback.
type TokenBucketLimiter struct {
	redisClient *redis.Client
	luaScript   *redis.Script
	mu          sync.RWMutex
	memoryMap   map[string]*inMemoryBucket
}

type inMemoryBucket struct {
	tokens      float64
	lastUpdated time.Time
}

const tokenBucketLua = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_updated')
local tokens = tonumber(bucket[1])
local last_updated = tonumber(bucket[2])

if not tokens then
    tokens = capacity
    last_updated = now
else
    local delta = math.max(0, now - last_updated)
    tokens = math.min(capacity, tokens + (delta * refill_rate))
    last_updated = now
end

local allowed = 0
if tokens >= requested then
    allowed = 1
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, 86400)
else
    redis.call('HMSET', key, 'tokens', tokens, 'last_updated', last_updated)
    redis.call('EXPIRE', key, 86400)
end

return {allowed, tokens, capacity}
`

// NewTokenBucketLimiter creates a new Token Bucket rate limiter instance.
func NewTokenBucketLimiter(rdb *redis.Client) *TokenBucketLimiter {
	return &TokenBucketLimiter{
		redisClient: rdb,
		luaScript:   redis.NewScript(tokenBucketLua),
		memoryMap:   make(map[string]*inMemoryBucket),
	}
}

// Check evaluates whether a request is allowed under the token bucket policy.
func (tbl *TokenBucketLimiter) Check(ctx context.Context, key string, capacity float64, refillRate float64, requested float64) (*TokenBucketResult, error) {
	now := time.Now().UnixNano() / int64(time.Second)

	if tbl.redisClient != nil {
		res, err := tbl.luaScript.Run(ctx, tbl.redisClient, []string{"tb:" + key}, capacity, refillRate, requested, now).Result()
		if err == nil {
			if slice, ok := res.([]interface{}); ok && len(slice) >= 3 {
				allowedVal := slice[0].(int64)
				remainingVal := 0.0
				switch v := slice[1].(type) {
				case int64:
					remainingVal = float64(v)
				case float64:
					remainingVal = v
				case string:
					remainingVal = 0.0
				}

				return &TokenBucketResult{
					Allowed:    allowedVal == 1,
					Remaining:  remainingVal,
					Capacity:   capacity,
					RefillRate: refillRate,
				}, nil
			}
		}
	}

	// Fallback to thread-safe in-memory token bucket if Redis is unavailable or unconfigured
	tbl.mu.Lock()
	defer tbl.mu.Unlock()

	bucket, exists := tbl.memoryMap[key]
	currentTime := time.Now()
	if !exists {
		bucket = &inMemoryBucket{
			tokens:      capacity,
			lastUpdated: currentTime,
		}
		tbl.memoryMap[key] = bucket
	}

	elapsed := currentTime.Sub(bucket.lastUpdated).Seconds()
	bucket.tokens = bucket.tokens + (elapsed * refillRate)
	if bucket.tokens > capacity {
		bucket.tokens = capacity
	}
	bucket.lastUpdated = currentTime

	allowed := false
	if bucket.tokens >= requested {
		allowed = true
		bucket.tokens -= requested
	}

	return &TokenBucketResult{
		Allowed:    allowed,
		Remaining:  bucket.tokens,
		Capacity:   capacity,
		RefillRate: refillRate,
	}, nil
}
