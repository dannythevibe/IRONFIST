/**
 * IronFist JavaScript SDK.
 *
 * - `IronFistClient`  runs in the browser with a PUBLISHABLE key (if_pk_…).
 *   It fingerprints the device and asks IronFist for a decision.
 * - `IronFistServer`  runs on your backend with a SECRET key (if_sk_…).
 *   It confirms a decision the browser reported, and manages devices.
 *
 * The browser is controlled by the user, so never trust a decision it hands
 * you. Send the `verification_id` to your server and confirm it there.
 *
 * No dependencies. Needs `fetch` (browsers, Node 18+).
 */

/** Hosted IronFist service. Override with `baseUrl` if you self-host. */
export const DEFAULT_BASE_URL = 'https://ironfist.theobsidianstudios0.workers.dev';

export interface HardwareTraits {
  // Identifiers
  keychain_id?: string;
  widevine_drm_id?: string;
  windows_guid?: string;
  io_platform_uuid?: string;
  smbios_serial?: string;
  machine_id?: string;
  idfv?: string;
  storage_id?: string;
  // Fingerprint
  os_platform?: string;
  os_version?: string;
  cpu_cores?: number;
  memory_gb?: number;
  gpu_renderer?: string;
  screen_resolution?: string;
  color_depth?: number;
  timezone?: string;
  language?: string;
  canvas_hash?: string;
  webgl_hash?: string;
}

export type Decision =
  | 'ALLOWED'
  | 'BLOCKED_TRIAL_REUSED'
  | 'BLOCKED_OVERRIDE'
  | 'BLOCKED_VPN'
  | 'INSUFFICIENT_SIGNALS'
  | 'RATE_LIMITED';

export interface IPCheck {
  ip: string;
  available: boolean;
  is_datacenter: boolean;
  is_vpn: boolean;
  is_tor: boolean;
  asn: number | null;
  org: string | null;
  country: string | null;
  risk_score: number;
}

export interface RateLimit {
  allowed: boolean;
  remaining: number;
  capacity: number;
  refill_rate: number;
  retry_after: number | null;
}

export interface VerifyResult {
  verification_id?: string;
  decision: Decision;
  allowed: boolean;
  reason: string;
  device_id?: string | null;
  new_device?: boolean;
  similarity_score?: number;
  deterministic?: boolean;
  trial_claimed?: boolean;
  ip_check?: IPCheck | null;
  rate_limit?: RateLimit | null;
  verified_at?: string;
}

export interface Verification {
  id: string;
  timestamp: string;
  account_id: string | null;
  device_id: string | null;
  client_ip: string | null;
  ip_check: IPCheck | null;
  similarity_score: number;
  deterministic: boolean;
  decision: Decision;
  allowed: boolean;
  reason: string | null;
  source: string | null;
}

export interface Device {
  id: string;
  traits: HardwareTraits;
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

export class IronFistError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'IronFistError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(baseUrl.replace(/\/+$/, '') + path, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  // A refused verification or an empty bucket is an answer, not a failure.
  if (res.status === 429 && data && data.allowed === false && !data.error) return data as T;
  if (!res.ok) {
    const err = data && data.error ? data.error : {};
    throw new IronFistError(res.status, err.code || 'http_error', err.message || `HTTP ${res.status}`);
  }
  return data as T;
}

// ------------------------------------------------------------------ browser

function toHex(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 where available (secure contexts); a 64-bit FNV-1a fallback otherwise. */
async function digest(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
  }
  return 'fnv' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

async function canvasHash(): Promise<string | undefined> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('IronFist \u{1F44A} fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = "18px 'Times New Roman'";
    ctx.fillText('IronFist \u{1F44A} fingerprint', 4, 32);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(200, 30, 22, 0, Math.PI * 2, true);
    ctx.fill();
    return await digest(canvas.toDataURL());
  } catch {
    return undefined;
  }
}

async function webglInfo(): Promise<{ renderer?: string; hash?: string }> {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return {};
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '') : '';
    const parts = [
      vendor,
      renderer,
      gl.getParameter(gl.VERSION),
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      gl.getParameter(gl.MAX_VARYING_VECTORS),
      gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      String(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)),
      String(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
      (gl.getSupportedExtensions() || []).join(','),
    ];
    return { renderer: renderer || undefined, hash: await digest(parts.join('|')) };
  } catch {
    return {};
  }
}

const STORAGE_KEY = 'ironfist_device_token';

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * A random token kept in localStorage and a first-party cookie. It identifies
 * the browser until the user clears site data; the canvas and WebGL hashes
 * are what let IronFist recognise the device after that.
 */
function storageId(): string | undefined {
  try {
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      id = null;
    }
    if (!id) {
      const m = document.cookie.match(new RegExp('(?:^|; )' + STORAGE_KEY + '=([0-9a-f]{32})'));
      id = m ? m[1] : null;
    }
    if (!id) id = randomToken();
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage blocked */
    }
    document.cookie = `${STORAGE_KEY}=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
    return id;
  } catch {
    return undefined;
  }
}

/** Collects the browser's fingerprint. Browser only. */
export async function collectBrowserTraits(): Promise<HardwareTraits> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'collectBrowserTraits() only works in a browser. On a server, forward the traits your client collected.',
    );
  }
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  const [canvas, webgl] = await Promise.all([canvasHash(), webglInfo()]);

  const traits: HardwareTraits = {
    storage_id: storageId(),
    os_platform: (nav.userAgentData && nav.userAgentData.platform) || nav.platform || 'web',
    cpu_cores: nav.hardwareConcurrency || undefined,
    memory_gb: nav.deviceMemory || undefined,
    gpu_renderer: webgl.renderer,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    color_depth: window.screen.colorDepth || undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: nav.language,
    canvas_hash: canvas,
    webgl_hash: webgl.hash,
  };
  // Drop empty values so the payload only carries real signals.
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(traits)) {
    const v = (traits as Record<string, unknown>)[key];
    if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return out as HardwareTraits;
}

export interface ClientOptions {
  /** Publishable key (if_pk_…). Safe to ship in client code. */
  apiKey: string;
  baseUrl?: string;
}

export interface VerifyOptions {
  /** Refuse connections from datacenters, VPNs, proxies and Tor. */
  requireNoVpn?: boolean;
  /** Supply your own traits instead of collecting them. */
  traits?: HardwareTraits;
}

export class IronFistClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: ClientOptions) {
    if (!options || !options.apiKey) throw new Error('IronFistClient: apiKey is required');
    if (options.apiKey.indexOf('if_sk_') === 0 && typeof window !== 'undefined') {
      throw new Error('IronFistClient: never put a secret key (if_sk_…) in browser code. Use a publishable key.');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  }

  collectTraits(): Promise<HardwareTraits> {
    return collectBrowserTraits();
  }

  /**
   * Fingerprints this device and asks whether `accountId` may start a trial on it.
   * Pass `result.verification_id` to your server and confirm it there.
   */
  async verify(accountId: string, options: VerifyOptions = {}): Promise<VerifyResult> {
    const traits = options.traits || (await this.collectTraits());
    return request<VerifyResult>(this.baseUrl, this.apiKey, 'POST', '/v1/verify', {
      account_id: accountId,
      hardware_traits: traits,
      require_no_vpn: options.requireNoVpn === true,
    });
  }
}

// ------------------------------------------------------------------- server

export interface ServerOptions {
  /** Secret key (if_sk_…). Server-side only. */
  secretKey: string;
  baseUrl?: string;
}

export class IronFistServer {
  private secretKey: string;
  private baseUrl: string;

  constructor(options: ServerOptions) {
    if (!options || !options.secretKey) throw new Error('IronFistServer: secretKey is required');
    if (typeof window !== 'undefined') {
      throw new Error('IronFistServer must not run in a browser: it would expose your secret key.');
    }
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  }

  /** Looks up a verification the client reported, straight from IronFist. */
  getVerification(verificationId: string): Promise<Verification> {
    return request(this.baseUrl, this.secretKey, 'GET', `/v1/verifications/${encodeURIComponent(verificationId)}`);
  }

  /**
   * True only if the verification exists, was allowed, and belongs to this
   * account. This is the check to gate a trial on.
   */
  async confirm(verificationId: string, accountId: string): Promise<boolean> {
    try {
      const v = await this.getVerification(verificationId);
      return v.allowed === true && v.account_id === accountId;
    } catch (err) {
      if (err instanceof IronFistError && err.status === 404) return false;
      throw err;
    }
  }

  /** Verifies traits your own client collected. No IP check is possible from a server. */
  verify(accountId: string, traits: HardwareTraits): Promise<VerifyResult> {
    return request(this.baseUrl, this.secretKey, 'POST', '/v1/verify', {
      account_id: accountId,
      hardware_traits: traits,
    });
  }

  listVerifications(limit = 50): Promise<{ verifications: Verification[] }> {
    return request(this.baseUrl, this.secretKey, 'GET', `/v1/verifications?limit=${limit}`);
  }

  listDevices(limit = 50): Promise<{ devices: Device[]; next_before: number | null }> {
    return request(this.baseUrl, this.secretKey, 'GET', `/v1/devices?limit=${limit}`);
  }

  getDevice(deviceId: string): Promise<Device> {
    return request(this.baseUrl, this.secretKey, 'GET', `/v1/devices/${encodeURIComponent(deviceId)}`);
  }

  blockDevice(deviceId: string, reason: string): Promise<Device> {
    return request(this.baseUrl, this.secretKey, 'POST', `/v1/devices/${encodeURIComponent(deviceId)}/override`, {
      blocked: true,
      reason,
    });
  }

  unblockDevice(deviceId: string): Promise<Device> {
    return request(this.baseUrl, this.secretKey, 'POST', `/v1/devices/${encodeURIComponent(deviceId)}/override`, {
      blocked: false,
    });
  }

  /** Lets the next account claim the trial on this device. */
  resetTrial(deviceId: string): Promise<Device> {
    return request(this.baseUrl, this.secretKey, 'POST', `/v1/devices/${encodeURIComponent(deviceId)}/reset-trial`);
  }

  /** General-purpose rate limiter: takes tokens from a named bucket in your workspace. */
  checkRateLimit(
    key: string,
    options: { capacity?: number; refillRate?: number; requested?: number } = {},
  ): Promise<RateLimit> {
    return request<RateLimit>(this.baseUrl, this.secretKey, 'POST', '/v1/token-bucket/check', {
      key,
      capacity: options.capacity,
      refill_rate: options.refillRate,
      requested: options.requested,
    });
  }
}
