package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/ironfist/ironfist-backend/limiter"
	"github.com/ironfist/ironfist-backend/matcher"
)

func TestVerifyTrialAndHandlers(t *testing.T) {
	testStorePath := "test_api_graph.json"
	defer os.Remove(testStorePath)
	defer os.Remove("ironfist_audit_logs.json")

	tb := limiter.NewTokenBucketLimiter(nil)
	fm := matcher.NewFuzzyGraphMatcher(testStorePath)
	srv := NewServer(tb, fm)

	// Test 1: Verify Trial - First Request (Allowed)
	reqBody := VerifyTrialRequest{
		APIKey:    "if_live_9a8b7c6d5e4f3a2b",
		AccountID: "user_test_101",
		HardwareTraits: matcher.HardwareTraits{
			KeychainID:       "kc_999",
			OSPlatform:       "darwin",
			CpuCores:         10,
			MemoryGB:         32,
			GpuRenderer:      "Apple M2 Max",
			ScreenResolution: "3024x1964",
		},
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/v1/verify-trial", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	srv.HandleVerifyTrial(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d", w.Code)
	}

	var resp VerifyTrialResponse
	json.NewDecoder(w.Body).Decode(&resp)

	if !resp.Allowed {
		t.Errorf("expected allowed=true, got %v", resp.Allowed)
	}
	if resp.Decision != "ALLOWED" {
		t.Errorf("expected decision=ALLOWED, got %s", resp.Decision)
	}

	// Test 2: Reused Device Verification (Exact Match Blocked)
	reqBody2 := VerifyTrialRequest{
		APIKey:    "if_live_9a8b7c6d5e4f3a2b",
		AccountID: "user_test_102", // different account on same physical device
		HardwareTraits: matcher.HardwareTraits{
			KeychainID: "kc_999",
			OSPlatform: "darwin",
		},
	}

	bodyBytes2, _ := json.Marshal(reqBody2)
	req2 := httptest.NewRequest("POST", "/v1/verify-trial", bytes.NewBuffer(bodyBytes2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()

	srv.HandleVerifyTrial(w2, req2)

	if w2.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden, got %d", w2.Code)
	}

	var resp2 VerifyTrialResponse
	json.NewDecoder(w2.Body).Decode(&resp2)

	if resp2.Allowed {
		t.Errorf("expected allowed=false on reused device, got true")
	}
	if resp2.Decision != "EXACT_MATCH_REUSE" {
		t.Errorf("expected decision=EXACT_MATCH_REUSE, got %s", resp2.Decision)
	}

	// Test 3: Check Graph Handler
	reqGraph := httptest.NewRequest("GET", "/v1/graph", nil)
	wGraph := httptest.NewRecorder()
	srv.HandleGetGraph(wGraph, reqGraph)

	if wGraph.Code != http.StatusOK {
		t.Errorf("expected graph endpoint status 200, got %d", wGraph.Code)
	}

	// Test 4: Live Feed Handler
	reqFeed := httptest.NewRequest("GET", "/v1/live-feed", nil)
	wFeed := httptest.NewRecorder()
	srv.HandleGetLiveFeed(wFeed, reqFeed)

	if wFeed.Code != http.StatusOK {
		t.Errorf("expected live feed status 200, got %d", wFeed.Code)
	}
}
