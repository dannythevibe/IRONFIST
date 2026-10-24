package matcher

import (
	"os"
	"testing"
)

func TestFuzzyGraphMatcher(t *testing.T) {
	testStorePath := "test_graph_store.json"
	defer os.Remove(testStorePath)

	m := NewFuzzyGraphMatcher(testStorePath)

	traits1 := HardwareTraits{
		KeychainID:       "keychain_abc_123",
		OSPlatform:       "ios",
		CpuCores:         8,
		MemoryGB:         16,
		GpuRenderer:      "Apple Metal GPU",
		ScreenResolution: "1170x2532",
		Timezone:         "America/New_York",
		Language:         "en-US",
		SubnetIP:         "192.168.1.10",
	}

	// 1. Register new device node
	res1, node1 := m.CheckAndRegister(traits1, "acc_user_1")
	if res1.Matched {
		t.Errorf("expected new device (matched=false), got matched=true")
	}
	if res1.MatchType != "NEW_DEVICE" {
		t.Errorf("expected match_type=NEW_DEVICE, got %s", res1.MatchType)
	}

	// Claim trial on device 1
	m.MarkTrialClaimed(node1.ID)

	// 2. Exact Deterministic Match
	res2, node2 := m.CheckAndRegister(traits1, "acc_user_2")
	if !res2.Matched || !res2.Deterministic {
		t.Errorf("expected deterministic match, got matched=%v, det=%v", res2.Matched, res2.Deterministic)
	}
	if res2.MatchType != "EXACT_MATCH_REUSE" {
		t.Errorf("expected EXACT_MATCH_REUSE, got %s", res2.MatchType)
	}
	if !res2.TrialAlreadyUsed {
		t.Errorf("expected trial_already_used=true on deterministic match")
	}
	if node2.ID != node1.ID {
		t.Errorf("expected node ID %s, got %s", node1.ID, node2.ID)
	}

	// 3. Soft Trait Fuzzy Match (wiped local storage, new keychain ID, same specs)
	traitsWiped := HardwareTraits{
		KeychainID:       "keychain_xyz_456", // changed/wiped keychain
		OSPlatform:       "ios",
		CpuCores:         8,
		MemoryGB:         16,
		GpuRenderer:      "Apple Metal GPU",
		ScreenResolution: "1170x2532",
		Timezone:         "America/New_York",
		Language:         "en-US",
		SubnetIP:         "192.168.1.50",
	}

	res3, _ := m.CheckAndRegister(traitsWiped, "acc_user_3")
	if !res3.Matched {
		t.Errorf("expected fuzzy trait match (S >= 0.88), got score=%.2f", res3.Score)
	}
	if res3.MatchType != "FUZZY_GRAPH_MATCH" {
		t.Errorf("expected FUZZY_GRAPH_MATCH, got %s", res3.MatchType)
	}
}

func TestCalculateSimilarity(t1 *testing.T) {
	traitsA := HardwareTraits{
		OSPlatform:       "windows",
		CpuCores:         16,
		MemoryGB:         32,
		GpuRenderer:      "NVIDIA GeForce RTX 4080",
		ScreenResolution: "2560x1440",
		SubnetIP:         "10.0.1.15",
		CanvasHash:       "canvas123",
	}

	traitsB := HardwareTraits{
		OSPlatform:       "windows",
		CpuCores:         16,
		MemoryGB:         32,
		GpuRenderer:      "NVIDIA GeForce RTX 4080",
		ScreenResolution: "2560x1440",
		SubnetIP:         "10.0.1.99",
		CanvasHash:       "canvas123",
	}

	score := CalculateSimilarity(traitsA, traitsB)
	if score < 0.88 {
		t1.Errorf("expected similarity score >= 0.88, got %.2f", score)
	}
}
