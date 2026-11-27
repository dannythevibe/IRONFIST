// IP risk classification from the network data Cloudflare attaches to each
// request (ASN, organisation, country). Pure logic, unit-tested with Node.
//
// This is a heuristic: it recognises traffic from hosting providers, the
// networks commercial VPNs and proxies run on, and Tor exits. A VPN that exits
// through a residential ISP is not detectable this way.

export interface IPCheckResult {
  ip: string;
  /** False when no network data was available (local development). */
  available: boolean;
  is_datacenter: boolean;
  is_vpn: boolean;
  is_tor: boolean;
  asn: number | null;
  org: string | null;
  country: string | null;
  risk_score: number;
}

export interface NetworkInfo {
  ip: string;
  asn?: number;
  org?: string;
  country?: string;
}

// Autonomous systems that host servers rather than home or mobile users.
const HOSTING_ASNS = new Set<number>([
  16509, 14618, 8987, // Amazon
  15169, 396982, 19527, // Google
  8075, 8068, // Microsoft
  13335, 209242, // Cloudflare (incl. WARP)
  14061, // DigitalOcean
  24940, 213230, // Hetzner
  16276, // OVH
  63949, // Akamai / Linode
  36183, 20940, 16625, // Akamai (incl. iCloud Private Relay egress)
  54113, // Fastly
  20473, // Vultr / Choopa
  31898, // Oracle Cloud
  45102, 37963, // Alibaba
  132203, 45090, // Tencent
  12876, // Scaleway
  51167, // Contabo
  60781, 28753, 30633, // Leaseweb
  9009, // M247
  60068, 212238, // Datacamp / CDN77
  62240, // Clouvider
  136787, 147049, // PacketHub / TEFINCOM (NordVPN)
  39351, // 31173 Services (Mullvad)
  53667, 36352, // FranTech / ColoCrossing
  46606, // Unified Layer
  29802, 46562, // HIVELOCITY / Performive
  32934, // Meta
  197540, // netcup
  8560, // IONOS
  26496, // GoDaddy
  55286, // B2 Net Solutions
  62563, // GTHost
  35916, // Multacom
  40676, // Psychz
  18978, // Enzu
  11878, // tzulo
]);

const HOSTING_KEYWORDS = [
  'hosting',
  'datacenter',
  'data center',
  'dedicated',
  'colocation',
  'vps',
  'server',
  'cloud',
  'cdn',
  'vpn',
  'proxy',
];

const VPN_KEYWORDS = [
  'vpn',
  'proxy',
  'm247',
  'datacamp',
  'packethub',
  'tefincom',
  '31173',
  'mullvad',
  'nordvpn',
  'expressvpn',
  'surfshark',
  'proton',
  'private internet access',
  'windscribe',
];

const VPN_ASNS = new Set<number>([9009, 60068, 212238, 136787, 147049, 39351, 62240]);

export function inspectIP(net: NetworkInfo): IPCheckResult {
  const org = net.org ?? null;
  const asn = typeof net.asn === 'number' ? net.asn : null;
  const country = net.country ?? null;

  if (asn === null && !org && !country) {
    return {
      ip: net.ip,
      available: false,
      is_datacenter: false,
      is_vpn: false,
      is_tor: false,
      asn: null,
      org: null,
      country: null,
      risk_score: 0,
    };
  }

  const orgLower = (org ?? '').toLowerCase();
  // Cloudflare reports Tor exit traffic under the pseudo country code T1.
  const isTor = country === 'T1';
  const isDatacenter =
    (asn !== null && HOSTING_ASNS.has(asn)) || HOSTING_KEYWORDS.some((k) => orgLower.includes(k));
  const isVpn =
    isTor || (asn !== null && VPN_ASNS.has(asn)) || VPN_KEYWORDS.some((k) => orgLower.includes(k));

  let risk = 5;
  if (isDatacenter) risk = 75;
  if (isVpn) risk = 85;
  if (isTor) risk = 95;

  return {
    ip: net.ip,
    available: true,
    is_datacenter: isDatacenter,
    is_vpn: isVpn,
    is_tor: isTor,
    asn,
    org,
    country: isTor ? null : country,
    risk_score: risk,
  };
}

/** True when the connection should be refused under a "no VPN" policy. */
export function isAnonymized(r: IPCheckResult): boolean {
  return r.is_datacenter || r.is_vpn || r.is_tor;
}
