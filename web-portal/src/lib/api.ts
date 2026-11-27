// Console API client. The console and the API share an origin, so requests
// are relative and authenticated by the session cookie.

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method || (options.body === undefined ? 'GET' : 'POST');
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the IronFist API. Check your connection.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (data && data.error) {
    throw new ApiError(res.status, data.error.code || 'error', data.error.message || 'Request failed');
  }
  // Refused verifications and empty buckets come back as 429 with a normal body.
  if (!res.ok && !(res.status === 429 && data)) {
    throw new ApiError(res.status, 'http_error', `Request failed (HTTP ${res.status})`);
  }
  return data as T;
}

export interface Workspace {
  id: string;
  name: string;
  tb_capacity: number;
  tb_refill_rate: number;
  match_threshold: number;
  created_at: string;
}

export interface ApiKey {
  id: string;
  kind: 'publishable' | 'secret';
  name: string;
  display: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface Device {
  id: string;
  traits: Record<string, string | number | undefined>;
  identifier_types: string[];
  associated_accounts: string[];
  trial_claimed: boolean;
  trial_account_id: string | null;
  claimed_at: string | null;
  blocked: boolean;
  block_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  timestamp: string;
  account_id: string | null;
  device_id: string | null;
  client_ip: string | null;
  ip_check: { org: string | null; country: string | null; is_vpn: boolean; is_datacenter: boolean; is_tor: boolean; available: boolean } | null;
  similarity_score: number;
  deterministic: boolean;
  decision: string;
  allowed: boolean;
  reason: string | null;
  source: string | null;
}

export interface Stats {
  verifications_total: number;
  verifications_blocked: number;
  verifications_24h: number;
  verifications_blocked_24h: number;
  devices: number;
  devices_blocked: number;
  devices_multi_account: number;
}

export interface BucketResult {
  allowed: boolean;
  remaining: number;
  capacity: number;
  refill_rate: number;
  retry_after: number | null;
}
