/**
 * MCP Client Factory
 *
 * Creates a connected @modelcontextprotocol/sdk Client using the Bodhi SDK's
 * transport config. Works transparently across direct and extension modes.
 *
 * Requires @modelcontextprotocol/sdk as a peer dependency.
 *
 * Usage:
 *   import { createMcpClient } from '@bodhiapp/bodhi-js-core/mcp';
 *   const mcpClient = await createMcpClient(client, mcp.path);
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpTransportConfig } from './mcp-fetch';

/** Any client that provides createMcpTransportConfig (UIClient, CliClient, etc.) */
export interface McpTransportProvider {
  createMcpTransportConfig(mcp_path: string): McpTransportConfig;
}

export interface CreateMcpClientOptions {
  name?: string;
  version?: string;
}

/**
 * Create a connected MCP Client for a given proxy path.
 *
 * @param client - Any Bodhi client with createMcpTransportConfig (UIClient, CliClient, etc.)
 * @param mcp_path - MCP proxy path from Mcp.path (e.g. '/bodhi/v1/apps/mcps/{id}/mcp')
 * @param options - Optional client name and version
 * @returns Connected @modelcontextprotocol/sdk Client ready for listTools(), callTool(), etc.
 */
export async function createMcpClient(
  client: McpTransportProvider,
  mcp_path: string,
  options?: CreateMcpClientOptions
): Promise<Client> {
  const config = client.createMcpTransportConfig(mcp_path);
  const transport = new StreamableHTTPClientTransport(config.url, { fetch: config.fetch });
  const mcpClient = new Client({
    name: options?.name ?? 'bodhi-mcp-client',
    version: options?.version ?? '1.0.0',
  });
  try {
    await mcpClient.connect(transport);
  } catch (e) {
    await transport.close().catch(() => {});
    throw e;
  }
  return mcpClient;
}
