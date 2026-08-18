package matcher

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// HardwareTraits holds deterministic and soft signals collected by client SDKs.
type HardwareTraits struct {
	// Deterministic Identifiers
	KeychainID      string `json:"keychain_id,omitempty"`      // iOS / macOS Keychain persistence
	WidevineDRMID   string `json:"widevine_drm_id,omitempty"`  // Android MediaDrm
	WindowsGuid     string `json:"windows_guid,omitempty"`     // Windows MachineGuid
	IOPlatformUUID  string `json:"io_platform_uuid,omitempty"` // macOS IOPlatformUUID
	SMBIOSSerial    string `json:"smbios_serial,omitempty"`    // SMBIOS Hardware Serial

	// Soft Traits
	OSPlatform       string `json:"os_platform"`       // ios, android, macos, windows, linux
	OSVersion        string `json:"os_version"`        // e.g. 17.4, 14.0, 11.0.1
	CpuCores         int    `json:"cpu_cores"`         // e.g. 8, 12, 16
	MemoryGB         int    `json:"memory_gb"`         // e.g. 16, 32
	GpuRenderer      string `json:"gpu_renderer"`      // e.g. Apple M2 Max, ANGLE (NVIDIA GeForce RTX 4080)
	ScreenResolution string `json:"screen_resolution"` // e.g. 2560x1440
	ColorDepth       int    `json:"color_depth"`       // e.g. 24, 32
	Timezone         string `json:"timezone"`          // e.g. America/New_York
	Language         string `json:"language"`          // e.g. en-US
	CanvasHash       string `json:"canvas_hash,omitempty"`
	WebGLHash        string `json:"webgl_hash,omitempty"`
	FontHash         string `json:"font_hash,omitempty"`
}

// GraphNode represents a known physical device node in the IronFist Graph.
type GraphNode struct {
	ID                 string         `json:"id"`
	PrimaryHash        string         `json:"primary_hash"`
	Traits             HardwareTraits `json:"traits"`
	AssociatedAccounts []string       `json:"associated_accounts"`
	TrialClaimed       bool           `json:"trial_claimed"`
	ClaimedAt          time.Time      `json:"claimed_at,omitempty"`
	Blocked            bool           `json:"blocked"`
	BlockReason        string         `json:"block_reason,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

// MatchResult details the similarity computation score and match status.
type MatchResult struct {
	Matched          bool       `json:"matched"`
	MatchedNodeID    string     `json:"matched_node_id,omitempty"`
	Score            float64    `json:"score"`
	Threshold        float64    `json:"threshold"`
	Deterministic    bool       `json:"deterministic"`
	TrialAlreadyUsed bool       `json:"trial_already_used"`
	Reason           string     `json:"reason"`
	MatchedNode      *GraphNode `json:"matched_node,omitempty"`
}

// PersistentStore schema for saving database state on disk.
type persistentGraphState struct {
	Nodes    map[string]*GraphNode `json:"nodes"`
	DetIndex map[string]string     `json:"det_index"`
}

// FuzzyGraphMatcher maintains the device relationship graph with real disk persistence.
type FuzzyGraphMatcher struct {
	mu        sync.RWMutex
	nodes     map[string]*GraphNode // nodeID -> GraphNode
	detIndex  map[string]string     // deterministicID -> nodeID
	Threshold float64               // default 0.88
	dbPath    string
}

// NewFuzzyGraphMatcher creates a new graph match engine backed by persistent disk storage.
func NewFuzzyGraphMatcher(dbPath string) *FuzzyGraphMatcher {
	if dbPath == "" {
		dbPath = "ironfist_graph_store.json"
	}

	m := &FuzzyGraphMatcher{
		nodes:     make(map[string]*GraphNode),
		detIndex:  make(map[string]string),
		Threshold: 0.88,
		dbPath:    dbPath,
	}

	// Load existing persistent storage from disk if present
	m.loadFromDisk()

	return m
}

// ComputeHash generates a deterministic SHA-256 fingerprint from hardware traits.
func ComputeHash(t HardwareTraits) string {
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%d|%d|%s|%s|%s",
		t.KeychainID, t.WidevineDRMID, t.WindowsGuid, t.IOPlatformUUID, t.SMBIOSSerial,
		t.OSPlatform, t.GpuRenderer, t.CpuCores, t.MemoryGB, t.ScreenResolution, t.CanvasHash, t.WebGLHash)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:16])
}

// CheckAndRegister performs real deterministic lookup and fuzzy similarity scoring ($S >= 0.88$).
func (m *FuzzyGraphMatcher) CheckAndRegister(traits HardwareTraits, accountID string) (*MatchResult, *GraphNode) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 1. Check Deterministic Identifiers (100% Match confidence)
	deterministicIDs := []string{
		traits.KeychainID,
		traits.WidevineDRMID,
		traits.WindowsGuid,
		traits.IOPlatformUUID,
		traits.SMBIOSSerial,
	}

	for _, detID := range deterministicIDs {
		if detID != "" {
			if nodeID, found := m.detIndex[detID]; found {
				if node, ok := m.nodes[nodeID]; ok {
					// Associate account if missing
					m.associateAccount(node, accountID)
					m.saveToDiskUnsafe()

					return &MatchResult{
						Matched:          true,
						MatchedNodeID:    node.ID,
						Score:            1.00,
						Threshold:        m.Threshold,
						Deterministic:    true,
						TrialAlreadyUsed: node.TrialClaimed,
						Reason:           "Deterministic Hardware ID match (" + detID + ")",
						MatchedNode:      node,
					}, node
				}
			}
		}
	}

	// 2. Trait Similarity Scoring Engine ($S >= 0.88$)
	var bestMatch *GraphNode
	bestScore := 0.0

	for _, node := range m.nodes {
		score := CalculateSimilarity(traits, node.Traits)
		if score > bestScore {
			bestScore = score
			bestMatch = node
		}
	}

	if bestMatch != nil && bestScore >= m.Threshold {
		m.associateAccount(bestMatch, accountID)
		m.indexDeterministicIDs(bestMatch.ID, traits)
		m.saveToDiskUnsafe()

		return &MatchResult{
			Matched:          true,
			MatchedNodeID:    bestMatch.ID,
			Score:            bestScore,
			Threshold:        m.Threshold,
			Deterministic:    false,
			TrialAlreadyUsed: bestMatch.TrialClaimed,
			Reason:           fmt.Sprintf("Fuzzy Graph Trait Match (Similarity S=%.3f >= %.2f)", bestScore, m.Threshold),
			MatchedNode:      bestMatch,
		}, bestMatch
	}

	// 3. New Physical Device Node
	newNodeID := "node_" + ComputeHash(traits)
	newNode := &GraphNode{
		ID:                 newNodeID,
		PrimaryHash:        ComputeHash(traits),
		Traits:             traits,
		AssociatedAccounts: []string{},
		TrialClaimed:       false,
		Blocked:            false,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	if accountID != "" {
		newNode.AssociatedAccounts = append(newNode.AssociatedAccounts, accountID)
	}

	m.nodes[newNodeID] = newNode
	m.indexDeterministicIDs(newNodeID, traits)
	m.saveToDiskUnsafe()

	return &MatchResult{
		Matched:          false,
		MatchedNodeID:    newNodeID,
		Score:            bestScore,
		Threshold:        m.Threshold,
		Deterministic:    false,
		TrialAlreadyUsed: false,
		Reason:           "New unique physical hardware node created",
		MatchedNode:      newNode,
	}, newNode
}

// CalculateSimilarity computes weighted similarity score (0.0 to 1.0) between two trait sets.
func CalculateSimilarity(t1, t2 HardwareTraits) float64 {
	if t1.OSPlatform != "" && t2.OSPlatform != "" && !strings.EqualFold(t1.OSPlatform, t2.OSPlatform) {
		return 0.10
	}

	weights := map[string]float64{
		"gpu":          0.25,
		"resolution":   0.20,
		"cpu_mem":      0.15,
		"timezone_lang": 0.10,
		"canvas_webgl": 0.30,
	}

	totalScore := 0.0

	// GPU Renderer
	if t1.GpuRenderer != "" && t2.GpuRenderer != "" {
		if strings.EqualFold(t1.GpuRenderer, t2.GpuRenderer) {
			totalScore += weights["gpu"]
		} else if strings.Contains(strings.ToLower(t1.GpuRenderer), strings.ToLower(t2.GpuRenderer)) ||
			strings.Contains(strings.ToLower(t2.GpuRenderer), strings.ToLower(t1.GpuRenderer)) {
			totalScore += weights["gpu"] * 0.7
		}
	}

	// Screen Resolution
	if t1.ScreenResolution != "" && t2.ScreenResolution != "" && t1.ScreenResolution == t2.ScreenResolution {
		totalScore += weights["resolution"]
	}

	// CPU Cores & Memory
	if t1.CpuCores > 0 && t2.CpuCores > 0 && t1.CpuCores == t2.CpuCores {
		cpuScore := 0.10
		if t1.MemoryGB > 0 && t2.MemoryGB > 0 && t1.MemoryGB == t2.MemoryGB {
			cpuScore += 0.05
		}
		totalScore += cpuScore
	}

	// Timezone & Language
	if t1.Timezone != "" && t2.Timezone != "" && t1.Timezone == t2.Timezone {
		totalScore += weights["timezone_lang"] * 0.6
	}
	if t1.Language != "" && t2.Language != "" && t1.Language == t2.Language {
		totalScore += weights["timezone_lang"] * 0.4
	}

	// Canvas / WebGL Hashes
	if t1.CanvasHash != "" && t2.CanvasHash != "" && t1.CanvasHash == t2.CanvasHash {
		totalScore += weights["canvas_webgl"] * 0.5
	}
	if t1.WebGLHash != "" && t2.WebGLHash != "" && t1.WebGLHash == t2.WebGLHash {
		totalScore += weights["canvas_webgl"] * 0.5
	}

	return math.Min(1.0, totalScore)
}

func (m *FuzzyGraphMatcher) associateAccount(node *GraphNode, accountID string) {
	if accountID == "" {
		return
	}
	for _, acc := range node.AssociatedAccounts {
		if acc == accountID {
			return
		}
	}
	node.AssociatedAccounts = append(node.AssociatedAccounts, accountID)
	node.UpdatedAt = time.Now()
}

func (m *FuzzyGraphMatcher) indexDeterministicIDs(nodeID string, traits HardwareTraits) {
	for _, id := range []string{traits.KeychainID, traits.WidevineDRMID, traits.WindowsGuid, traits.IOPlatformUUID, traits.SMBIOSSerial} {
		if id != "" {
			m.detIndex[id] = nodeID
		}
	}
}

// GetNodes returns all graph nodes for visualizer.
func (m *FuzzyGraphMatcher) GetNodes() []*GraphNode {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]*GraphNode, 0, len(m.nodes))
	for _, n := range m.nodes {
		res = append(res, n)
	}
	return res
}

// MarkTrialClaimed flags a device node as having consumed a free trial.
func (m *FuzzyGraphMatcher) MarkTrialClaimed(nodeID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if node, exists := m.nodes[nodeID]; exists {
		node.TrialClaimed = true
		node.ClaimedAt = time.Now()
		node.UpdatedAt = time.Now()
		m.saveToDiskUnsafe()
		return true
	}
	return false
}

// SetOverride manually whitelists or blocks a device node.
func (m *FuzzyGraphMatcher) SetOverride(nodeID string, blocked bool, reason string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if node, exists := m.nodes[nodeID]; exists {
		node.Blocked = blocked
		node.BlockReason = reason
		node.UpdatedAt = time.Now()
		m.saveToDiskUnsafe()
		return true
	}
	return false
}

func (m *FuzzyGraphMatcher) loadFromDisk() {
	data, err := os.ReadFile(m.dbPath)
	if err != nil {
		return
	}
	var state persistentGraphState
	if err := json.Unmarshal(data, &state); err == nil {
		if state.Nodes != nil {
			m.nodes = state.Nodes
		}
		if state.DetIndex != nil {
			m.detIndex = state.DetIndex
		}
	}
}

func (m *FuzzyGraphMatcher) saveToDiskUnsafe() {
	state := persistentGraphState{
		Nodes:    m.nodes,
		DetIndex: m.detIndex,
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err == nil {
		_ = os.MkdirAll(filepath.Dir(m.dbPath), 0755)
		_ = os.WriteFile(m.dbPath, data, 0644)
	}
}
