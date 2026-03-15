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

## Discovering Available Tools

After login, list the MCPs the user approved. Tools are available directly on each MCP object via `tools_cache`:

```tsx
// Get approved MCPs — each has tools_cache with its tools
const { mcps } = await client.mcps.list();

interface McpTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// Access tools directly from tools_cache (no extra API call needed)
for (const mcp of mcps) {
  const tools: McpTool[] = mcp.tools_cache ?? [];
  console.log(`${mcp.slug}: ${tools.length} tools`);
}
```

## Converting MCP Tools to Chat Format

LLMs expect tools in OpenAI function-calling format. Use `mcp__slug__name` naming convention so you can route execution back to the correct MCP:

```tsx
function mcpToolsToChatFormat(mcps: Array<{ slug: string; tools_cache?: McpTool[] }>) {
  const tools = [];
  for (const mcp of mcps) {
    for (const t of mcp.tools_cache ?? []) {
      tools.push({
        type: 'function' as const,
        function: {
          name: `mcp__${mcp.slug}__${t.name}`,
          description: t.description,
          parameters: t.input_schema || { type: 'object', properties: {} },
        },
      });
    }
  }
  return tools;
}

// Parse mcp__slug__name back to components
function parseToolName(prefixed: string): { mcpSlug: string; toolName: string } | null {
  const parts = prefixed.split('__');
  if (parts.length !== 3 || parts[0] !== 'mcp') return null;
  return { mcpSlug: parts[1], toolName: parts[2] };
}

// Resolve slug to UUID for API calls
function findMcpUuid(slug: string, mcps: Array<{ id: string; slug: string }>): string | undefined {
  return mcps.find(m => m.slug === slug)?.id;
}
```

## The Agent Loop

The core pattern: send messages to LLM → check for tool calls → execute tools → feed results back → repeat until LLM responds with text only.

```tsx
import type { UIClient } from '@bodhiapp/bodhi-js-react';

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

async function agentLoop(
  client: UIClient,
  model: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof mcpToolsToChatFormat>,
  mcps: Array<{ id: string; slug: string }>,
  onChunk: (content: string) => void
): Promise<ChatMessage[]> {
  const conversation = [...messages];

  while (true) {
    // 1. Send to LLM with tools
    const stream = client.chat.completions.create({
      model,
      messages: conversation,
      ...(tools.length > 0 && { tools }),
      stream: true,
    });

    // 2. Collect response — text content and tool calls
    let content = '';
    const toolCalls: ToolCall[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        content += delta.content;
        onChunk(delta.content);
      }

      // Tool calls arrive as deltas across multiple chunks — accumulate them
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index === undefined) continue;
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = { id: '', function: { name: '', arguments: '' } };
          }
          if (tc.id) toolCalls[tc.index].id = tc.id;
          if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
          if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }

    // 3. No tool calls — LLM is done, return final conversation
    if (toolCalls.length === 0) {
      conversation.push({ role: 'assistant', content });
      return conversation;
    }

    // 4. Add assistant message with tool_calls
    conversation.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: tc.function,
      })),
    });

    // 5. Execute each tool and add results
    for (const tc of toolCalls) {
      const parsed = parseToolName(tc.function.name);
      let result: string;

      if (!parsed) {
        result = JSON.stringify({ error: `Invalid tool name: ${tc.function.name}` });
      } else {
        try {
          const mcpId = findMcpUuid(parsed.mcpSlug, mcps);
          if (!mcpId) throw new Error(`MCP '${parsed.mcpSlug}' not found`);
          const args = JSON.parse(tc.function.arguments || '{}');
          const toolResult = await client.mcps.executeTool(mcpId, parsed.toolName, args);
          result = JSON.stringify(toolResult);
        } catch (err) {
          result = JSON.stringify({
            error: err instanceof Error ? err.message : 'Tool execution failed',
          });
        }
      }

      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }

    // 6. Loop continues — LLM processes tool results and may call more tools
  }
}
```

## Complete React Component: Agentic Chat with MCP

Full implementation with MCP selection checkboxes, tool calling, and agent loop:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useBodhi } from '@bodhiapp/bodhi-js-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

interface McpTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function AgenticChat() {
  const { client, isOverallReady, isAuthenticated } = useBodhi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  // MCP state
  const [availableMcps, setAvailableMcps] = useState<Array<{ id: string; slug: string; tools_cache?: McpTool[] }>>([]);
  const [enabledMcps, setEnabledMcps] = useState<Set<string>>(new Set());

  // Load models after authentication
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const ids: string[] = [];
      for await (const m of client.models.list()) ids.push(m.id);
      setModels(ids);
      if (ids.length > 0) setSelectedModel(ids[0]);
    })();
  }, [client, isAuthenticated]);

  // Load approved MCPs (tools available via tools_cache)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      const mcpsResponse = await client.mcps.list();
      setAvailableMcps(mcpsResponse.mcps);
    })();
  }, [client, isAuthenticated]);

  // Toggle MCP for current chat
  const toggleMcp = (slug: string) => {
    setEnabledMcps(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  // Build chat tools from enabled MCPs
  const getActiveTools = useCallback(() => {
    const tools = [];
    for (const mcp of availableMcps) {
      if (!enabledMcps.has(mcp.slug)) continue;
      for (const t of mcp.tools_cache ?? []) {
        tools.push({
          type: 'function' as const,
          function: {
            name: `mcp__${mcp.slug}__${t.name}`,
            description: t.description,
            parameters: t.input_schema || { type: 'object', properties: {} },
          },
        });
      }
    }
    return tools;
  }, [availableMcps, enabledMcps]);

  const sendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');
    setIsProcessing(true);

    try {
      const tools = getActiveTools();
      let conversation = [...currentMessages];

      // Agent loop: send → check tool calls → execute → feed back → repeat
      while (true) {
        const stream = client.chat.completions.create({
          model: selectedModel,
          messages: conversation,
          ...(tools.length > 0 && { tools }),
          stream: true,
        });

        let content = '';
        const toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];

        // Stream response and update UI in real-time
        setMessages([...conversation, { role: 'assistant', content: '' }]);

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;

          if (delta?.content) {
            content += delta.content;
            setMessages([...conversation, { role: 'assistant', content }]);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index === undefined) continue;
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: '', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        // No tool calls — LLM responded with text, we're done
        if (toolCalls.length === 0) {
          conversation.push({ role: 'assistant', content });
          setMessages(conversation);
          break;
        }

        // Add assistant message with tool calls
        conversation.push({
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: tc.function })),
        });

        // Execute each tool call
        for (const tc of toolCalls) {
          const parsed = parseToolName(tc.function.name);
          let result: string;

          if (!parsed) {
            result = JSON.stringify({ error: `Invalid tool name: ${tc.function.name}` });
          } else {
            try {
              const mcpId = findMcpUuid(parsed.mcpSlug, availableMcps);
              if (!mcpId) throw new Error(`MCP '${parsed.mcpSlug}' not found`);
              const args = JSON.parse(tc.function.arguments || '{}');
              const toolResult = await client.mcps.executeTool(mcpId, parsed.toolName, args);
              result = JSON.stringify(toolResult);
            } catch (err) {
              result = JSON.stringify({ error: err instanceof Error ? err.message : 'Failed' });
            }
          }

          conversation.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }

        // Update UI with tool results, then loop continues
        setMessages([...conversation]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOverallReady || !isAuthenticated) return null;

  return (
    <div>
      {/* MCP toggles — user selects which tools are active for this chat */}
      {availableMcps.length > 0 && (
        <div>
          <h3>MCP Tools</h3>
          {availableMcps.map(mcp => (
            <label key={mcp.slug} style={{ display: 'block' }}>
              <input type="checkbox" checked={enabledMcps.has(mcp.slug)} onChange={() => toggleMcp(mcp.slug)} />
              {mcp.slug} ({(mcp.tools_cache ?? []).length} tools)
            </label>
          ))}
        </div>
      )}

      {/* Model selector */}
      <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
        {models.map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Messages */}
      <div>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.role}:</strong>
            {msg.content && <span>{msg.content}</span>}
            {msg.tool_calls && <div style={{ color: 'gray' }}>Calling: {msg.tool_calls.map(tc => tc.function.name.split('__').pop()).join(', ')}</div>}
            {msg.role === 'tool' && (
              <details>
                <summary>Tool result</summary>
                <pre>{msg.content}</pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." disabled={isProcessing} />
        <button onClick={sendMessage} disabled={isProcessing || !input.trim()}>
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

## Refreshing MCP Tools

MCP servers can update their tool list. Refresh the cached tools:

```tsx
const refreshed = await client.mcps.refreshTools(mcpId);
```

## Endpoints Reference

| SDK Method                                  | HTTP | Endpoint                                      |
| ------------------------------------------- | ---- | --------------------------------------------- |
| `client.mcps.list()`                        | GET  | /bodhi/v1/apps/mcps                           |
| `client.mcps.listTools(id)`                 | GET  | /bodhi/v1/apps/mcps/{id}/tools                |
| `client.mcps.refreshTools(id)`              | POST | /bodhi/v1/apps/mcps/{id}/tools/refresh        |
| `client.mcps.executeTool(id, name, params)` | POST | /bodhi/v1/apps/mcps/{id}/tools/{name}/execute |
