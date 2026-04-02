# Agentic Patterns with Bodhi JS SDK

Complete guide for building agentic applications that use MCP tools via the Bodhi JS SDK.

## Prerequisites

Your app must request MCP access during `login()`. Without this, SDK APIs return empty results because the user hasn't consented to share their resources with your app.

```tsx
await login({
  requested: {
    mcp_servers: [
      { url: 'https://mcp.exa.ai/mcp' }, // Web search MCP
      { url: 'http://localhost:3001' }, // Local MCP server
    ],
  },
});
```

## Discovering Available MCP Servers

After login, list the MCPs the user approved. Each MCP has a `path` field for proxy connection:

```tsx
// Get approved MCPs — each has path for proxy connection
const { mcps } = await client.mcps.list();

for (const mcp of mcps) {
  console.log(`${mcp.slug}: ${mcp.path}`);
  // mcp.path is e.g. '/bodhi/v1/apps/mcps/{id}/mcp'
}
```

## Tool Discovery and Execution via createMcpClient

Use `createMcpClient(client, mcp.path)` to create a connected `@modelcontextprotocol/sdk` Client for each MCP. This works with all client types (UIClient, CliClient).

### Web/React

```tsx
import { useBodhi } from '@bodhiapp/bodhi-js-react';
import { createMcpClient } from '@bodhiapp/bodhi-js-react/mcp';

const { client } = useBodhi();
const { mcps } = await client.mcps.list();

for (const mcp of mcps) {
  const mcpClient = await createMcpClient(client, mcp.path);
  const { tools } = await mcpClient.listTools();
  // Convert tools to chat format for LLM tool calling
  // Execute tools via mcpClient.callTool({ name, arguments })
  await mcpClient.close();
}
```

### CLI/Headless

```typescript
import { CliClient } from '@bodhiapp/bodhi-js-cli';
import { createMcpClient } from '@bodhiapp/bodhi-js-cli/mcp';

const client = new CliClient({ authClientId, authServerUrl, serverUrl });
await client.login({
  requested: { mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }] },
  onReviewUrl: url => console.log(url),
});

const { mcps } = await client.mcps.list();
for (const mcp of mcps) {
  const mcpClient = await createMcpClient(client, mcp.path);
  const { tools } = await mcpClient.listTools();
  const result = await mcpClient.callTool({ name: 'search', arguments: { query: 'AI news' } });
  await mcpClient.close();
}
```

> **Peer dependency**: `@modelcontextprotocol/sdk` must be installed in your project.

## The Agent Loop

The core pattern for agentic chat remains: send messages to LLM with tools, check for tool calls, execute tools via `createMcpClient`, feed results back, repeat until the LLM responds with text only.

Use `client.mcps.list()` to discover MCP servers and their `path` values, then `createMcpClient(client, mcp.path)` for tool listing and execution within the agent loop.

## Practical Insights (from building real apps)

These are lessons learned from building agentic chat apps with the SDK.

### Agent Loop Iteration Cap

Always cap the agent loop to prevent runaway tool-call cycles. 25 iterations is a reasonable limit:

```tsx
let iterations = 0;
while (iterations < 25) {
  iterations++;
  // ... stream, check tool calls, execute via MCP SDK, loop
}
```

### Separating UI Messages from LLM Conversation

The LLM needs raw `{role, content, tool_calls, tool_call_id}` format. The UI needs richer types (tool status, MCP display names, streaming state). Keep two data structures:

1. **`AgenticMessage[]`** -- UI-facing, with `ToolCallInfo` objects tracking status per tool call
2. **`conversation[]`** -- raw format built from AgenticMessage for each LLM call

A `buildConversation(messages)` function converts UI messages to LLM format, always prepending the system prompt.

### Tool Call Status Tracking

Track each tool call through states for UI visualization:

```
pending -> executing -> completed | error
```

Update the assistant message's `tool_calls` array immutably as each tool progresses. This lets the UI show inline status cards that update in real-time.

### AbortController for Cleanup

Always use `AbortController` with a `useRef` for streaming:

- Abort on component unmount
- Abort on "new chat" / clear
- Abort previous request when user sends a new message
- Check `signal.aborted` before every `await` and state update in the loop

### TypeScript: Passing Tools to chat.completions.create

The SDK's `chat.completions.create()` type expects OpenAI-compatible tool format, but the TypeScript types may not align perfectly. Cast via `unknown` if needed:

```tsx
const stream = client.chat.completions.create({
  model,
  messages: conversation,
  tools: chatTools.length > 0 ? (chatTools as unknown as ChatCompletionRequestMessage[]) : undefined,
  stream: true,
} as Parameters<typeof client.chat.completions.create>[0]);
```

## Endpoints Reference

| SDK Method           | HTTP | Endpoint            |
| -------------------- | ---- | ------------------- |
| `client.mcps.list()` | GET  | /bodhi/v1/apps/mcps |

> **Note**: MCP tool operations (list tools, refresh, execute) are handled via `@modelcontextprotocol/sdk` using `createMcpClient(client, mcp.path)`.
