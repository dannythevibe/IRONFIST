-- IronFist schema (Cloudflare D1 / SQLite)

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE workspaces (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  tb_capacity     REAL NOT NULL DEFAULT 100,
  tb_refill_rate  REAL NOT NULL DEFAULT 5,
  match_threshold REAL NOT NULL DEFAULT 0.88,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_workspaces_owner ON workspaces (owner_id);

-- API keys are stored as SHA-256 hashes; the full key is shown once at creation.
CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('publishable', 'secret')),
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  display      TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at   INTEGER
);
CREATE INDEX idx_api_keys_workspace ON api_keys (workspace_id);

-- One row per physical device, scoped to a workspace.
CREATE TABLE device_nodes (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  os_platform      TEXT,
  canvas_hash      TEXT,
  webgl_hash       TEXT,
  traits_json      TEXT NOT NULL,
  trial_claimed    INTEGER NOT NULL DEFAULT 0,
  trial_account_id TEXT,
  claimed_at       INTEGER,
  blocked          INTEGER NOT NULL DEFAULT 0,
  block_reason     TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX idx_device_nodes_ws ON device_nodes (workspace_id, updated_at DESC);
CREATE INDEX idx_device_nodes_canvas ON device_nodes (workspace_id, canvas_hash);
CREATE INDEX idx_device_nodes_webgl ON device_nodes (workspace_id, webgl_hash);

-- Index of hashed hardware identifiers -> device. Raw identifiers are never stored.
CREATE TABLE device_ids (
  workspace_id TEXT NOT NULL,
  id_type      TEXT NOT NULL,
  id_hash      TEXT NOT NULL,
  node_id      TEXT NOT NULL REFERENCES device_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_id, id_type, id_hash)
);
CREATE INDEX idx_device_ids_node ON device_ids (node_id);

CREATE TABLE account_links (
  node_id    TEXT NOT NULL REFERENCES device_nodes(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  linked_at  INTEGER NOT NULL,
  PRIMARY KEY (node_id, account_id)
);

CREATE TABLE verifications (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id    TEXT,
  node_id       TEXT,
  client_ip     TEXT,
  ip_json       TEXT,
  match_score   REAL NOT NULL DEFAULT 0,
  deterministic INTEGER NOT NULL DEFAULT 0,
  decision      TEXT NOT NULL,
  allowed       INTEGER NOT NULL DEFAULT 0,
  reason        TEXT,
  source        TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_verifications_ws ON verifications (workspace_id, created_at DESC);
CREATE INDEX idx_verifications_created ON verifications (created_at);
