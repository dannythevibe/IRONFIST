// Model Context Protocol endpoint (Streamable HTTP transport, stateless).
// Every request is a self-contained JSON-RPC POST authenticated by a secret
// key, so there is no session to keep and nothing shared between clients.

import { authenticateApiKey } from './auth.ts';
import { getDeviceView, listDevices, setOverride } from './devices.ts';
import { HttpError, json, type Env, type Workspace } from './http.ts';
import { checkDeveloperBucket, parseOverride } from './publicapi.ts';
import { checkBucket, enforceLimit } from './ratelimit.ts';
import { listVerifications, runVerification } from './verify.ts';

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const TRAITS_SCHEMA = {
  type: 'object',
  description:
    'Signals collected on the device by an IronFist SDK. Needs at least one hardware identifier or a canvas/WebGL hash.',
  properties: {
    keychain_id: { type: 'string' },
    widevine_drm_id: { type: 'string' },
    windows_guid: { type: 'string' },
    io_platform_uuid: { type: 'string' },
    smbios_serial: { type: 'string' },
    machine_id: { type: 'string' },
    idfv: { type: 'string' },
    storage_id: { type: 'string' },
    os_platform: { type: 'string' },
    os_version: { type: 'string' },
    cpu_cores: { type: 'number' },
    memory_gb: { type: 'number' },
    gpu_renderer: { type: 'string' },
    screen_resolution: { type: 'string' },
    color_depth: { type: 'number' },
    timezone: { type: 'string' },
    language: { type: 'string' },
    canvas_hash: { type: 'string' },
    webgl_hash: { type: 'string' },
  },
};

const TOOLS = [
  {
    name: 'ironfist_verify_device',
    description:
      'Checks whether an account may claim a free trial on a device. Matches the hardware traits against known devices in the workspace, registers the device if it is new, and returns the decision. This call is server-side, so no IP check is performed.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Your identifier for the user or account' },
        hardware_traits: TRAITS_SCHEMA,
      },
      required: ['account_id', 'hardware_traits'],
    },
  },
  {
    name: 'ironfist_list_devices',
    description: 'Lists known devices in the workspace, most recently seen first, with their linked accounts.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many to return (1-100, default 20)' } },
    },
  },
  {
    name: 'ironfist_get_device',
    description: 'Returns one device: its traits, linked accounts, trial status and block status.',
    inputSchema: {
      type: 'object',
      properties: { device_id: { type: 'string' } },
      required: ['device_id'],
    },
  },
  {
    name: 'ironfist_override_device',
    description: 'Blocks or unblocks a device. A blocked device is refused on every verification.',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string' },
        blocked: { type: 'boolean', description: 'true to block, false to unblock' },
        reason: { type: 'string', description: 'Why; required when blocking' },
      },
      required: ['device_id', 'blocked'],
    },
  },
  {
    name: 'ironfist_recent_verifications',
    description: 'Returns the most recent verification decisions in the workspace.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many to return (1-100, default 20)' } },
    },
  },
  {
    name: 'ironfist_check_token_bucket',
    description:
      'Takes tokens from a named rate-limit bucket in the workspace and reports whether the request fits. Omitted capacity and refill_rate default to the workspace settings.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Bucket name, for example a user ID or IP address' },
        capacity: { type: 'number', description: 'Maximum tokens' },
        refill_rate: { type: 'number', description: 'Tokens added per second' },
        requested: { type: 'number', description: 'Tokens to take (default 1)' },
      },
      required: ['key'],
    },
  },
];

function limitArg(args: Record<string, unknown>): number {
  const n = Number(args.limit);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 20;
}

async function callTool(env: Env, ws: Workspace, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'ironfist_verify_device': {
      const limit = await checkBucket(env, `verify:${ws.id}`, ws.tb_capacity, ws.tb_refill_rate, 1);
      if (!limit.allowed) throw new HttpError(429, 'rate_limited', 'Workspace verification rate limit exceeded');
      return runVerification(env, ws, args as never, null, limit, 'mcp');
    }
    case 'ironfist_list_devices':
      return listDevices(env, ws.id, limitArg(args), null);
    case 'ironfist_get_device':
      return getDeviceView(env, ws.id, String(args.device_id ?? ''));
    case 'ironfist_override_device': {
      const { blocked, reason } = parseOverride(args);
      return setOverride(env, ws.id, String(args.device_id ?? ''), blocked, reason);
    }
    case 'ironfist_recent_verifications':
      return { verifications: await listVerifications(env, ws.id, limitArg(args)) };
    case 'ironfist_check_token_bucket':
      return checkDeveloperBucket(env, ws, args);
    default:
      throw new HttpError(404, 'unknown_tool', `Unknown tool: ${name}`);
  }
}

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: RpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/** Handles one JSON-RPC message. Returns null for notifications, which get no reply. */
async function handleMessage(env: Env, ws: Workspace, msg: RpcRequest): Promise<unknown | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid JSON-RPC request');
  }
  const isNotification = msg.id === undefined;
  const params = msg.params ?? {};

  switch (msg.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      return rpcResult(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'ironfist', version: '3.0.0' },
        instructions: `Connected to the IronFist workspace "${ws.name}". Tools inspect and manage that workspace's device graph.`,
      });
    }
    case 'ping':
      return rpcResult(msg.id, {});
    case 'tools/list':
      return rpcResult(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : '';
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<
        string,
        unknown
      >;
      try {
        const data = await callTool(env, ws, name, args);
        return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
      } catch (err) {
        if (err instanceof HttpError && err.code === 'unknown_tool') return rpcError(msg.id, -32602, err.message);
        // Tool failures are reported in the result so the model can read and react to them.
        const message = err instanceof HttpError ? err.message : 'Internal error';
        if (!(err instanceof HttpError)) console.error('mcp tool error', name, err);
        return rpcResult(msg.id, { content: [{ type: 'text', text: message }], isError: true });
      }
    }
    default:
      if (isNotification) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    // No server-initiated stream is offered; the spec's answer to GET is 405.
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  }

  let auth;
  try {
    auth = await authenticateApiKey(request, env, ctx, true);
  } catch (err) {
    if (err instanceof HttpError) {
      return json(rpcError(null, -32001, err.message), err.status, {
        'WWW-Authenticate': 'Bearer realm="ironfist"',
      });
    }
    throw err;
  }
  await enforceLimit(env, `mcp:${auth.workspace.id}`, 120, 10);

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0 || payload.length > 20) {
      return json(rpcError(null, -32600, 'Batch must contain 1 to 20 messages'), 400);
    }
    const replies = [];
    for (const msg of payload) {
      const reply = await handleMessage(env, auth.workspace, msg as RpcRequest);
      if (reply !== null) replies.push(reply);
    }
    return replies.length ? json(replies) : new Response(null, { status: 202 });
  }

  const reply = await handleMessage(env, auth.workspace, payload as RpcRequest);
  return reply === null ? new Response(null, { status: 202 }) : json(reply);
}
