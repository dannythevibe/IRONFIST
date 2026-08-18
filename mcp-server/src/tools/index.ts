import fetch from 'node-fetch';

const GATEWAY_URL = process.env.IRONFIST_GATEWAY_URL || 'http://localhost:8080';

export interface HardwareTraitsInput {
  keychain_id?: string;
  widevine_drm_id?: string;
  windows_guid?: string;
  io_platform_uuid?: string;
  smbios_serial?: string;
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

export async function verifyDeviceTool(args: {
  api_key?: string;
  account_id: string;
  hardware_traits: HardwareTraitsInput;
  require_no_vpn?: boolean;
}) {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/verify-trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to connect to IronFist Gateway at ${GATEWAY_URL}: ${err.message}`,
        },
      ],
    };
  }
}

export async function checkTokenBucketTool(args: {
  key?: string;
  capacity?: number;
  refill_rate?: number;
  requested?: number;
}) {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/token-bucket/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to check token bucket: ${err.message}`,
        },
      ],
    };
  }
}

export async function overrideUserTool(args: {
  node_id: string;
  blocked: boolean;
  reason: string;
}) {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/override-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to execute override: ${err.message}`,
        },
      ],
    };
  }
}
