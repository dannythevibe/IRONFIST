-- IronFist Anti-Abuse Engine PostgreSQL Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    mcp_secret VARCHAR(255) NOT NULL,
    tb_capacity DOUBLE PRECISION DEFAULT 100.0,
    tb_refill_rate DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Graph Nodes
CREATE TABLE IF NOT EXISTS device_nodes (
    id VARCHAR(255) PRIMARY KEY,
    primary_hash VARCHAR(255) NOT NULL,
    keychain_id VARCHAR(255),
    widevine_id VARCHAR(255),
    windows_guid VARCHAR(255),
    io_platform_uuid VARCHAR(255),
    smbios_serial VARCHAR(255),
    traits_json JSONB NOT NULL,
    trial_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Account Links
CREATE TABLE IF NOT EXISTS account_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(255) REFERENCES device_nodes(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(node_id, account_id)
);

-- Audit Verification Logs
CREATE TABLE IF NOT EXISTS verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    account_id VARCHAR(255),
    client_ip VARCHAR(100),
    is_vpn BOOLEAN DEFAULT FALSE,
    is_datacenter BOOLEAN DEFAULT FALSE,
    match_score DOUBLE PRECISION NOT NULL,
    is_deterministic BOOLEAN DEFAULT FALSE,
    decision VARCHAR(50) NOT NULL, -- ALLOWED, BLOCKED_TRIAL_REUSED, BLOCKED_OVERRIDE, BLOCKED_VPN, RATE_LIMITED
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_nodes_det ON device_nodes (keychain_id, widevine_id, windows_guid, io_platform_uuid);
CREATE INDEX IF NOT EXISTS idx_verification_logs_created ON verification_logs (created_at DESC);
