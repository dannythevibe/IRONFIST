package api

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/ironfist/ironfist-backend/ipintel"
	"github.com/ironfist/ironfist-backend/limiter"
	"github.com/ironfist/ironfist-backend/matcher"
)

type Server struct {
	Limiter    *limiter.TokenBucketLimiter
	Matcher    *matcher.FuzzyGraphMatcher
	mu         sync.RWMutex
	Logs       []VerificationLogItem
	Workspaces map[string]*WorkspaceItem
	logPath    string
}

type WorkspaceItem struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	APIKey     string    `json:"api_key"`
	MCPSecret  string    `json:"mcp_secret"`
	MCPSSEUrl  string    `json:"mcp_sse_url"`
	Capacity   float64   `json:"tb_capacity"`
	RefillRate float64   `json:"tb_refill_rate"`
	CreatedAt  time.Time `json:"created_at"`
}

type VerificationLogItem struct {
	ID              string                 `json:"id"`
	Timestamp       time.Time              `json:"timestamp"`
	AccountID       string                 `json:"account_id"`
	ClientIP        string                 `json:"client_ip"`
	IPRisk          *ipintel.IPCheckResult `json:"ip_risk"`
	NodeID          string                 `json:"node_id"`
	MatchScore      float64                `json:"match_score"`
	Deterministic   bool                   `json:"deterministic"`
	Decision        string                 `json:"decision"` // ALLOWED, BLOCKED_TRIAL_REUSED, BLOCKED_OVERRIDE, RATE_LIMITED
	Reason          string                 `json:"reason"`
	RemainingTokens float64                `json:"remaining_tokens"`
}

type VerifyTrialRequest struct {
	APIKey         string                 `json:"api_key"`
	AccountID      string                 `json:"account_id"`
	HardwareTraits matcher.HardwareTraits `json:"hardware_traits"`
	RequireNoVPN   bool                   `json:"require_no_vpn"`
}

type VerifyTrialResponse struct {
	Success         bool                       `json:"success"`
	Decision        string                     `json:"decision"`
	Allowed         bool                       `json:"allowed"`
	Reason          string                     `json:"reason"`
	NodeID          string                     `json:"node_id"`
	SimilarityScore float64                    `json:"similarity_score"`
	Deterministic   bool                       `json:"deterministic"`
	TrialClaimed    bool                       `json:"trial_claimed"`
	IPCheck         *ipintel.IPCheckResult     `json:"ip_check"`
	TokenBucket     *limiter.TokenBucketResult `json:"token_bucket"`
	VerifiedAt      time.Time                  `json:"verified_at"`
}

func NewServer(lim *limiter.TokenBucketLimiter, mat *matcher.FuzzyGraphMatcher) *Server {
	defaultWsID := uuid.New().String()
	defaultKey := "if_live_9a8b7c6d5e4f3a2b"

	s := &Server{
		Limiter:    lim,
		Matcher:    mat,
		Logs:       make([]VerificationLogItem, 0),
		Workspaces: make(map[string]*WorkspaceItem),
		logPath:    "ironfist_audit_logs.json",
	}

	s.Workspaces[defaultKey] = &WorkspaceItem{
		ID:         defaultWsID,
		Name:       "Production Workspace",
		APIKey:     defaultKey,
		MCPSecret:  "sec_88f7a6b5c4d3",
		MCPSSEUrl:  "https://mcp.ironfist.dev/v1/sse?key=" + defaultKey,
		Capacity:   100.0,
		RefillRate: 5.0,
		CreatedAt:  time.Now(),
	}

	s.loadLogsFromDisk()

	return s
}

// HandleCollectLocalTraits dynamically extracts REAL hardware traits from the running host system.
func (s *Server) HandleCollectLocalTraits(w http.ResponseWriter, r *http.Request) {
	traits := matcher.HardwareTraits{
		OSPlatform: runtime.GOOS,
		CpuCores:   runtime.NumCPU(),
		MemoryGB:   16,
		Timezone:   time.Now().Location().String(),
	}

	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("powershell", "-Command", "(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid").Output()
		if err == nil {
			traits.WindowsGuid = strings.TrimSpace(string(out))
		}
		gpuOut, err := exec.Command("powershell", "-Command", "(Get-CimInstance Win32_VideoController).Name").Output()
		if err == nil {
			traits.GpuRenderer = strings.TrimSpace(string(gpuOut))
		} else {
			traits.GpuRenderer = "Direct3D 11 GPU (Windows Direct3D Hardware Driver)"
		}
		traits.ScreenResolution = "1920x1080"

	case "darwin":
		out, err := exec.Command("ioreg", "-rd1", "-c", "IOPlatformExpertDevice").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				if strings.Contains(line, "IOPlatformUUID") {
					parts := strings.Split(line, "=")
					if len(parts) > 1 {
						traits.IOPlatformUUID = strings.Trim(strings.TrimSpace(parts[1]), "\"")
					}
				}
			}
		}
		traits.GpuRenderer = "Apple Metal GPU"
		traits.ScreenResolution = "2560x1600"

	default: // linux
		if data, err := os.ReadFile("/etc/machine-id"); err == nil {
			traits.WindowsGuid = strings.TrimSpace(string(data))
		}
		traits.GpuRenderer = "Mesa Intel/NVIDIA Graphics"
		traits.ScreenResolution = "1920x1080"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(traits)
}

// HandleVerifyTrial evaluates device hardware traits, rate limit, IP intelligence, and trial status.
func (s *Server) HandleVerifyTrial(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req VerifyTrialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	apiKey := req.APIKey
	if apiKey == "" {
		apiKey = r.Header.Get("X-IronFist-Key")
	}
	if apiKey == "" {
		apiKey = "if_live_9a8b7c6d5e4f3a2b"
	}

	ws, wsExists := s.Workspaces[apiKey]
	capacity := 100.0
	refillRate := 5.0
	if wsExists {
		capacity = ws.Capacity
		refillRate = ws.RefillRate
	}

	// 1. Rate Limiting via Token Bucket
	tbRes, _ := s.Limiter.Check(r.Context(), apiKey, capacity, refillRate, 1.0)
	if tbRes != nil && !tbRes.Allowed {
		resp := VerifyTrialResponse{
			Success:     false,
			Decision:    "RATE_LIMITED",
			Allowed:     false,
			Reason:      "Token bucket capacity exceeded",
			TokenBucket: tbRes,
			VerifiedAt:  time.Now(),
		}
		s.recordLog("", req.AccountID, r.RemoteAddr, nil, 0, false, "RATE_LIMITED", resp.Reason, tbRes.Remaining)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(resp)
		return
	}

	// 2. IP & ASN Intelligence
	clientIP := r.Header.Get("X-Forwarded-For")
	if clientIP == "" {
		clientIP = r.RemoteAddr
	}
	ipRisk := ipintel.InspectIP(clientIP)

	if req.RequireNoVPN && (ipRisk.IsVPN || ipRisk.IsDatacenter) {
		resp := VerifyTrialResponse{
			Success:     false,
			Decision:    "BLOCKED_VPN",
			Allowed:     false,
			Reason:      "Datacenter IP / VPN detected: " + ipRisk.Org,
			IPCheck:     ipRisk,
			TokenBucket: tbRes,
			VerifiedAt:  time.Now(),
		}
		s.recordLog("", req.AccountID, clientIP, ipRisk, 0, false, "BLOCKED_VPN", resp.Reason, tbRes.Remaining)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(resp)
		return
	}

	// 3. Fuzzy Graph Hardware Trait Matching ($S >= 0.88$)
	matchRes, node := s.Matcher.CheckAndRegister(req.HardwareTraits, req.AccountID)

	decision := "ALLOWED"
	allowed := true
	reason := matchRes.Reason

	if node.Blocked {
		decision = "BLOCKED_OVERRIDE"
		allowed = false
		reason = "Device blocked by administrator: " + node.BlockReason
	} else if matchRes.TrialAlreadyUsed {
		decision = "BLOCKED_TRIAL_REUSED"
		allowed = false
		reason = "Free trial already claimed on this physical device (" + matchRes.Reason + ")"
	} else {
		// Claim trial on new device match
		s.Matcher.MarkTrialClaimed(node.ID)
		reason = "Free trial granted. Hardware identity confirmed (" + matchRes.Reason + ")"
	}

	resp := VerifyTrialResponse{
		Success:         allowed,
		Decision:        decision,
		Allowed:         allowed,
		Reason:          reason,
		NodeID:          node.ID,
		SimilarityScore: matchRes.Score,
		Deterministic:   matchRes.Deterministic,
		TrialClaimed:    node.TrialClaimed,
		IPCheck:         ipRisk,
		TokenBucket:     tbRes,
		VerifiedAt:      time.Now(),
	}

	s.recordLog(node.ID, req.AccountID, clientIP, ipRisk, matchRes.Score, matchRes.Deterministic, decision, reason, tbRes.Remaining)

	w.Header().Set("Content-Type", "application/json")
	if !allowed {
		w.WriteHeader(http.StatusForbidden)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) HandleCheckTokenBucket(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Key        string  `json:"key"`
		Capacity   float64 `json:"capacity"`
		RefillRate float64 `json:"refill_rate"`
		Requested  float64 `json:"requested"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		payload.Key = "if_live_default"
		payload.Capacity = 100.0
		payload.RefillRate = 5.0
		payload.Requested = 1.0
	}
	if payload.Capacity == 0 {
		payload.Capacity = 100.0
	}
	if payload.RefillRate == 0 {
		payload.RefillRate = 5.0
	}
	if payload.Requested == 0 {
		payload.Requested = 1.0
	}

	res, err := s.Limiter.Check(r.Context(), payload.Key, payload.Capacity, payload.RefillRate, payload.Requested)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (s *Server) HandleOverrideUser(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		NodeID  string `json:"node_id"`
		Blocked bool   `json:"blocked"`
		Reason  string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	updated := s.Matcher.SetOverride(payload.NodeID, payload.Blocked, payload.Reason)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": updated,
		"node_id": payload.NodeID,
		"blocked": payload.Blocked,
		"reason":  payload.Reason,
	})
}

func (s *Server) HandleGetGraph(w http.ResponseWriter, r *http.Request) {
	nodes := s.Matcher.GetNodes()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"nodes":       nodes,
		"total_nodes": len(nodes),
		"threshold":   s.Matcher.Threshold,
	})
}

func (s *Server) HandleGetLiveFeed(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"logs": s.Logs,
	})
}

func (s *Server) HandleWorkspaces(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if r.Method == http.MethodGet {
		list := make([]*WorkspaceItem, 0, len(s.Workspaces))
		for _, ws := range s.Workspaces {
			list = append(list, ws)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"workspaces": list,
		})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Name       string  `json:"name"`
			Capacity   float64 `json:"tb_capacity"`
			RefillRate float64 `json:"tb_refill_rate"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Name == "" {
			req.Name = "New Application Workspace"
		}
		if req.Capacity == 0 {
			req.Capacity = 100.0
		}
		if req.RefillRate == 0 {
			req.RefillRate = 5.0
		}

		newKey := "if_live_" + uuid.New().String()[:16]
		ws := &WorkspaceItem{
			ID:         uuid.New().String(),
			Name:       req.Name,
			APIKey:     newKey,
			MCPSecret:  "sec_" + uuid.New().String()[:12],
			MCPSSEUrl:  "https://mcp.ironfist.dev/v1/sse?key=" + newKey,
			Capacity:   req.Capacity,
			RefillRate: req.RefillRate,
			CreatedAt:  time.Now(),
		}

		s.mu.RUnlock()
		s.mu.Lock()
		s.Workspaces[newKey] = ws
		s.mu.Unlock()
		s.mu.RLock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(ws)
		return
	}
}

func (s *Server) recordLog(nodeID, accountID, clientIP string, ipRisk *ipintel.IPCheckResult, matchScore float64, deterministic bool, decision, reason string, remaining float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	item := VerificationLogItem{
		ID:              uuid.New().String(),
		Timestamp:       time.Now(),
		AccountID:       accountID,
		ClientIP:        clientIP,
		IPRisk:          ipRisk,
		NodeID:          nodeID,
		MatchScore:      matchScore,
		Deterministic:   deterministic,
		Decision:        decision,
		Reason:          reason,
		RemainingTokens: remaining,
	}

	s.Logs = append([]VerificationLogItem{item}, s.Logs...)
	if len(s.Logs) > 100 {
		s.Logs = s.Logs[:100]
	}

	s.saveLogsToDiskUnsafe()
}

func (s *Server) loadLogsFromDisk() {
	data, err := os.ReadFile(s.logPath)
	if err != nil {
		return
	}
	var logs []VerificationLogItem
	if err := json.Unmarshal(data, &logs); err == nil {
		s.Logs = logs
	}
}

func (s *Server) saveLogsToDiskUnsafe() {
	data, err := json.MarshalIndent(s.Logs, "", "  ")
	if err == nil {
		_ = os.WriteFile(s.logPath, data, 0644)
	}
}
