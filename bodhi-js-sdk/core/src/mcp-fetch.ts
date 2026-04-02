/**
 * MCP Transport Fetch Adapters
 *
 * Provides FetchLike functions for MCP StreamableHTTPClientTransport
 * that work transparently across direct and extension connection modes.
 */

import type { StreamTextResult } from './interface';

/**
 * Standard fetch signature compatible with @modelcontextprotocol/sdk's FetchLike
 */
export type McpFetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Configuration returned by createMcpTransportConfig for creating MCP transports
 */
export interface McpTransportConfig {
  url: URL;
  fetch: McpFetchLike;
}

/**
 * Creates a FetchLike for direct mode — standard fetch with Bearer token injection.
 */
export function createDirectMcpFetch(getToken: () => Promise<string | null>): McpFetchLike {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };
}

/**
 * Creates a FetchLike for extension mode — routes HTTP through the Bodhi SDK client's
 * streamText method which forwards raw response text without any parsing.
 */
export function createExtensionMcpFetch(client: {
  streamText(
    method: string,
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>,
    authenticated?: boolean
  ): Promise<StreamTextResult>;
}): McpFetchLike {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const endpoint = new URL(urlStr).pathname;
    const method = init?.method || 'GET';
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => {
        headers[k] = v;
      });
    }
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    const result = await client.streamText(method, endpoint, body, headers, true);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of result.body) {
            controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      status: result.status,
      headers: result.headers,
    });
  };
}
