import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import {
  verifyDeviceTool,
  checkTokenBucketTool,
  overrideUserTool,
} from './tools/index.js';

const mcpServer = new Server(
  {
    name: 'ironfist-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register MCP Tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ironfist_verify_device',
        description:
          'Analyzes client hardware traits (Keychain ID, Widevine DRM, MachineGuid, soft signals) and checks trial eligibility, rate limits, and IP risk.',
        inputSchema: {
          type: 'object',
          properties: {
            api_key: { type: 'string', description: 'IronFist workspace API Key' },
            account_id: { type: 'string', description: 'User or account identifier being registered/verified' },
            hardware_traits: {
              type: 'object',
              description: 'Hardware signals collected from native client SDK',
              properties: {
                keychain_id: { type: 'string' },
                widevine_drm_id: { type: 'string' },
                windows_guid: { type: 'string' },
                io_platform_uuid: { type: 'string' },
                smbios_serial: { type: 'string' },
                os_platform: { type: 'string' },
                os_version: { type: 'string' },
                cpu_cores: { type: 'number' },
                memory_gb: { type: 'number' },
                gpu_renderer: { type: 'string' },
                screen_resolution: { type: 'string' },
                timezone: { type: 'string' },
                canvas_hash: { type: 'string' },
                webgl_hash: { type: 'string' },
              },
            },
            require_no_vpn: { type: 'boolean', description: 'Reject request if client is behind Datacenter IP or VPN' },
          },
          required: ['account_id', 'hardware_traits'],
        },
      },
      {
        name: 'ironfist_check_token_bucket',
        description:
          'Evaluates remaining token capacity and refill rate under atomic Redis Lua token bucket rate limiting.',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Workspace or client bucket key' },
            capacity: { type: 'number', description: 'Max token capacity' },
            refill_rate: { type: 'number', description: 'Tokens refilled per second' },
            requested: { type: 'number', description: 'Tokens requested (default 1)' },
          },
        },
      },
      {
        name: 'ironfist_override_user',
        description:
          'Manually whitelist or block a physical device node ID for customer support or abuse enforcement.',
        inputSchema: {
          type: 'object',
          properties: {
            node_id: { type: 'string', description: 'Target physical device node ID' },
            blocked: { type: 'boolean', description: 'True to block device, false to whitelist' },
            reason: { type: 'string', description: 'Audit log reason' },
          },
          required: ['node_id', 'blocked', 'reason'],
        },
      },
    ],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'ironfist_verify_device':
      return await verifyDeviceTool(args as any);
    case 'ironfist_check_token_bucket':
      return await checkTokenBucketTool(args as any);
    case 'ironfist_override_user':
      return await overrideUserTool(args as any);
    default:
      throw new Error(`Unknown IronFist tool: ${name}`);
  }
});

// Run Mode: SSE HTTP Server or Stdio CLI
const PORT = process.env.MCP_PORT || 3001;
const MODE = process.argv.includes('--stdio') ? 'stdio' : 'sse';

if (MODE === 'stdio') {
  const transport = new StdioServerTransport();
  mcpServer.connect(transport).then(() => {
    console.error('IronFist MCP Server running on Stdio transport');
  });
} else {
  const app = express();
  let sseTransport: SSEServerTransport | null = null;

  app.get('/v1/sse', async (req, res) => {
    console.log('[MCP SSE] New client connection request key:', req.query.key);
    sseTransport = new SSEServerTransport('/v1/messages', res);
    await mcpServer.connect(sseTransport);
  });

  app.post('/v1/messages', async (req, res) => {
    if (sseTransport) {
      await sseTransport.handlePostMessage(req, res);
    } else {
      res.status(400).send('No active SSE connection');
    }
  });

  app.listen(PORT, () => {
    console.log(`👊 IronFist MCP SSE Server listening on http://localhost:${PORT}/v1/sse`);
  });
}
