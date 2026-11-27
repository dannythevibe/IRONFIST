// Pure device-matching logic: trait sanitising and similarity scoring.
// No Cloudflare APIs here so it can be unit-tested with plain Node.

/** Identifier types that pin a device exactly. Listed in lookup priority order. */
export const HARD_ID_TYPES = [
  'keychain_id',
  'widevine_drm_id',
  'windows_guid',
  'io_platform_uuid',
  'smbios_serial',
  'machine_id',
  'idfv',
] as const;

/**
 * Identifiers that survive normal use but are erased by a storage wipe or
 * reinstall. They identify a device when present, but a different value does
 * not prove a different device.
 */
export const SOFT_ID_TYPES = ['storage_id'] as const;

export const ID_TYPES: readonly string[] = [...HARD_ID_TYPES, ...SOFT_ID_TYPES];

export interface SoftTraits {
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
  font_hash?: string;
}

export interface SanitizedTraits {
  /** Raw identifier values by type. Hashed before they are stored. */
  ids: Record<string, string>;
  soft: SoftTraits;
}

const STRING_FIELDS = [
  'os_platform',
  'os_version',
  'gpu_renderer',
  'screen_resolution',
  'timezone',
  'language',
  'canvas_hash',
  'webgl_hash',
  'font_hash',
] as const;

const NUMBER_FIELDS = ['cpu_cores', 'memory_gb', 'color_depth'] as const;

const MAX_STRING = 256;

function cleanString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.slice(0, MAX_STRING);
}

/** Keeps only known fields, with bounded sizes. Unknown fields are dropped. */
export function sanitizeTraits(input: unknown): SanitizedTraits {
  const out: SanitizedTraits = { ids: {}, soft: {} };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const raw = input as Record<string, unknown>;

  for (const type of ID_TYPES) {
    const v = cleanString(raw[type]);
    if (v) out.ids[type] = v;
  }
  // Older Android SDK builds sent the app-storage identifier under this name.
  if (!out.ids.storage_id) {
    const legacy = cleanString(raw.encrypted_sp_id);
    if (legacy) out.ids.storage_id = legacy;
  }

  for (const f of STRING_FIELDS) {
    const v = cleanString(raw[f]);
    if (v) out.soft[f] = v;
  }
  for (const f of NUMBER_FIELDS) {
    const v = raw[f];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e6) {
      out.soft[f] = Math.round(v * 100) / 100;
    }
  }
  return out;
}

/**
 * A device can only be recognised again if it sent an identifier or a
 * high-entropy fingerprint. CPU count and screen size alone are shared by
 * millions of devices.
 */
export function hasEnoughSignal(t: SanitizedTraits): boolean {
  return Object.keys(t.ids).length > 0 || canFuzzyMatch(t.soft);
}

export function canFuzzyMatch(soft: SoftTraits): boolean {
  return Boolean(soft.canvas_hash || soft.webgl_hash);
}

const WEIGHTS: Record<string, number> = {
  canvas_hash: 0.3,
  webgl_hash: 0.25,
  gpu_renderer: 0.15,
  screen_resolution: 0.1,
  cpu_cores: 0.05,
  memory_gb: 0.05,
  timezone: 0.05,
  language: 0.03,
  color_depth: 0.02,
};

/** Share of total weight that must be comparable before a score means anything. */
const MIN_COMPARABLE = 0.5;

function eq(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

/**
 * Similarity between two trait sets, from 0 to 1.
 *
 * Only traits present on BOTH sides are compared, and the score is the matched
 * share of that comparable weight. Returns 0 when the platforms differ, when
 * neither high-entropy fingerprint (canvas, WebGL) is comparable, or when too
 * little is comparable to tell devices apart.
 */
export function calculateSimilarity(a: SoftTraits, b: SoftTraits): number {
  if (a.os_platform && b.os_platform && !eq(a.os_platform, b.os_platform)) return 0;

  let comparable = 0;
  let matched = 0;
  let highEntropyComparable = false;

  for (const [field, weight] of Object.entries(WEIGHTS)) {
    const va = (a as Record<string, unknown>)[field];
    const vb = (b as Record<string, unknown>)[field];
    if (va === undefined || vb === undefined) continue;
    comparable += weight;
    if (field === 'canvas_hash' || field === 'webgl_hash') highEntropyComparable = true;

    if (eq(va, vb)) {
      matched += weight;
    } else if (field === 'gpu_renderer') {
      // "Apple M2" vs "ANGLE (Apple, Apple M2, OpenGL 4.1)" is the same GPU.
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa.includes(sb) || sb.includes(sa)) matched += weight * 0.7;
    }
  }

  if (!highEntropyComparable || comparable < MIN_COMPARABLE) return 0;
  return Math.round((matched / comparable) * 1000) / 1000;
}

/**
 * True when both sides carry the same kind of hard identifier with different
 * values, which proves they are different devices however alike they look.
 */
export function hasHardIdConflict(
  incoming: Record<string, string>,
  stored: Record<string, string>,
): boolean {
  for (const type of HARD_ID_TYPES) {
    if (incoming[type] && stored[type] && incoming[type] !== stored[type]) return true;
  }
  return false;
}
