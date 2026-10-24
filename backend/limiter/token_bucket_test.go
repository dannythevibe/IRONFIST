package limiter

import (
	"context"
	"testing"
	"time"
)

func TestTokenBucketInMem(t *testing.T) {
	limiter := NewTokenBucketLimiter(nil)
	ctx := context.Background()

	// Initial check with capacity 5.0, refill 1.0/sec
	res, err := limiter.Check(ctx, "test_key", 5.0, 1.0, 1.0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !res.Allowed {
		t.Errorf("expected allowed=true, got %v", res.Allowed)
	}
	if res.Capacity != 5.0 {
		t.Errorf("expected capacity=5.0, got %f", res.Capacity)
	}
	if res.Remaining < 3.9 || res.Remaining > 4.1 {
		t.Errorf("expected remaining around 4.0, got %f", res.Remaining)
	}

	// Consume remaining tokens
	for i := 0; i < 4; i++ {
		res, err = limiter.Check(ctx, "test_key", 5.0, 1.0, 1.0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	// Next check should be rejected
	res, err = limiter.Check(ctx, "test_key", 5.0, 1.0, 1.0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Allowed {
		t.Errorf("expected rate limit blocked (allowed=false), got %v", res.Allowed)
	}

	// Wait 1.1s for token refill
	time.Sleep(1100 * time.Millisecond)
	res, err = limiter.Check(ctx, "test_key", 5.0, 1.0, 1.0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Allowed {
		t.Errorf("expected allowed=true after refill wait, got %v", res.Allowed)
	}
}
