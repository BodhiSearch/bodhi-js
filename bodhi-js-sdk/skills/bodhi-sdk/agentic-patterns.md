# Agentic Patterns with Bodhi JS SDK

Complete guide for building agentic applications that use MCP tools via the Bodhi JS SDK.

## Prerequisites

Your app must request MCP access during `login()`. Without this, SDK APIs return empty results because the user hasn't consented to share their resources with your app.

```tsx
await login({
  mcps: true, // request the MCP access section; the user grants specific MCPs on the consent page
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
  mcps: true,
  onAuthUrl: url => console.log(url),
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

## MCP Tool Namespacing

When multiple MCP servers are used simultaneously, prefix tool names with the MCP server's `slug` to avoid collisions. The convention is `mcp__{slug}__{toolName}`:

```tsx
const allTools = [];
for (const mcp of mcps) {
  const mcpClient = await createMcpClient(client, mcp.path);
  const { tools } = await mcpClient.listTools();
  for (const tool of tools) {
    allTools.push({
      ...tool,
      name: `mcp__${mcp.slug}__${tool.name}`, // namespaced tool name for LLM
      _mcpSlug: mcp.slug,
      _originalName: tool.name,
    });
  }
}
```

When the LLM returns a tool call, reverse the namespace to find the right client:

```tsx
function parseMcpToolName(namespacedName: string) {
  const match = namespacedName.match(/^mcp__([^_]+(?:_[^_]+)*)__(.+)$/);
  if (!match) return null;
  return { slug: match[1], toolName: match[2] };
}
```

## Tool Call Delta Accumulation

Streaming tool calls arrive in chunks (one `index` per tool call, fields fragmented across chunks). Accumulate by index before executing:

```tsx
// In the streaming loop:
const toolCallDeltas: Record<number, { id: string; name: string; argumentsJson: string }> = {};

for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta;
  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      const idx = tc.index;
      if (!toolCallDeltas[idx]) {
        toolCallDeltas[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', argumentsJson: '' };
      }
      if (tc.id) toolCallDeltas[idx].id = tc.id;
      if (tc.function?.name) toolCallDeltas[idx].name += tc.function.name;
      if (tc.function?.arguments) toolCallDeltas[idx].argumentsJson += tc.function.arguments;
    }
  }
  if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
    // All tool call deltas are complete — execute them
    break;
  }
}

// After streaming, execute accumulated tool calls
const toolCalls = Object.values(toolCallDeltas);
```

## The Agent Loop

The core pattern for agentic chat: send messages to LLM with tools, check for tool calls, execute tools via `createMcpClient`, feed results back, repeat until the LLM responds with text only.

Use `client.mcps.list()` to discover MCP servers and their `path` values, then `createMcpClient(client, mcp.path)` for tool listing and execution within the agent loop.

```tsx
// Simplified agent loop structure
async function runAgentLoop(userMessage: string, mcpClients: Map<string, Client>) {
  const messages = [{ role: 'user', content: userMessage }];
  let iterations = 0;
  const MAX_ITERATIONS = 25;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const toolCallDeltas: Record<number, { id: string; name: string; argumentsJson: string }> = {};
    let assistantText = '';
    let finishReason = '';

    const stream = client.chat.completions.create({
      model,
      messages,
      tools: allTools, // namespaced tool definitions
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) assistantText += delta.content;
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallDeltas[idx]) toolCallDeltas[idx] = { id: '', name: '', argumentsJson: '' };
          if (tc.id) toolCallDeltas[idx].id = tc.id;
          if (tc.function?.name) toolCallDeltas[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCallDeltas[idx].argumentsJson += tc.function.arguments;
        }
      }
      finishReason = chunk.choices?.[0]?.finish_reason ?? '';
    }

    const toolCalls = Object.values(toolCallDeltas);

    if (finishReason !== 'tool_calls' || toolCalls.length === 0) {
      return assistantText; // Done
    }

    // Add assistant message with tool_calls to history
    messages.push({
      role: 'assistant',
      content: assistantText || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.argumentsJson },
      })),
    });

    // Execute each tool call and add results
    for (const tc of toolCalls) {
      const parsed = parseMcpToolName(tc.name);
      if (!parsed) continue;
      const mcpClient = mcpClients.get(parsed.slug);
      if (!mcpClient) continue;
      const args = JSON.parse(tc.argumentsJson);
      const result = await mcpClient.callTool({ name: parsed.toolName, arguments: args });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result.content) });
    }
  }
}
```

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
