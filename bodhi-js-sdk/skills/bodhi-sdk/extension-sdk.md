# Bodhi JS SDK — Chrome Extension Development

Guide for building Chrome extensions that connect to Bodhi App using extension-specific SDK packages. These use `chrome.runtime` messaging and `chrome.identity` for auth instead of the web SDK's `window.bodhiext` and browser redirects.

## Package Selection

| Package                        | Use Case                                          |
| ------------------------------ | ------------------------------------------------- |
| `@bodhiapp/bodhi-js-react-ext` | React extension popup/options pages (recommended) |
| `@bodhiapp/bodhi-js-ext`       | Vanilla JS extension scripts                      |

## Quick Start (React Extension)

### 1. Install

```bash
npm install @bodhiapp/bodhi-js-react-ext
```

### 2. Wrap Extension UI

```tsx
// popup/App.tsx
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-ext';

function App() {
  return (
    <BodhiProvider authClientId="your-extension-client-id">
      <ExtensionContent />
    </BodhiProvider>
  );
}
```

### 3. Use the SDK

```tsx
import { useBodhi } from '@bodhiapp/bodhi-js-react-ext';

function ExtensionContent() {
  const { client, isOverallReady, isAuthenticated, login } = useBodhi();

  // Same useBodhi() API and login flow as web — see main skill
  // Key difference: auth uses chrome.identity, not browser redirects

  if (!isOverallReady) return <div>Connecting to Bodhi...</div>;
  if (!isAuthenticated) {
    return (
      <button
        onClick={() =>
          login({
            requested: { mcp_servers: [{ url: 'https://mcp.exa.ai/mcp' }] },
          })
        }
      >
        Login
      </button>
    );
  }

  return <ChatUI />;
}
```

## How Extension SDK Differs from Web SDK

### Communication Layer

| Feature         | Web SDK                  | Extension SDK                         |
| --------------- | ------------------------ | ------------------------------------- |
| Transport       | `window.bodhiext` API    | `chrome.runtime` messaging            |
| Auth flow       | Browser redirect + PKCE  | `chrome.identity.launchWebAuthFlow()` |
| Token storage   | localStorage             | `chrome.storage.session`              |
| Direct fallback | HTTP to localhost        | HTTP to localhost (same)              |
| Streaming       | SSE via extension bridge | Port-based with 60s timeout           |

### Three-Client Architecture

The extension SDK uses three internal client types (ExtUIClient facade manages them):

1. **BodhiExtClient** — `chrome.runtime.sendMessage()` to the Bodhi Browser extension
2. **ExtClient** — Internal `chrome.runtime` messaging within your extension
3. **DirectExtClient** — Direct HTTP fallback (same as web direct mode)

### Auth via chrome.identity

```typescript
// Happens automatically when you call login() — no config needed beyond authClientId
chrome.identity.launchWebAuthFlow(
  {
    url: authorizationUrl,
    interactive: true,
  },
  redirectUrl => {
    /* extract code, exchange for tokens */
  }
);
```

### Manifest v3 Permissions

Your extension's `manifest.json` needs:

```json
{
  "permissions": ["identity", "storage"],
  "externally_connectable": {
    "ids": ["*"]
  }
}
```

## Vanilla JS Extension

For background scripts or non-React extension code:

```typescript
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('your-client-id', {
  authServerUrl: 'https://main-id.getbodhi.app/realms/bodhi',
  logLevel: 'debug',
});

await client.init();

// Same client API as web — chat, models, embeddings, MCPs
const stream = client.chat.completions.create({
  model: 'gemma-3n-e4b-it',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of stream) {
  console.log(chunk.choices?.[0]?.delta?.content || '');
}
```

## Extension ↔ Extension Communication (ext2ext)

Direct messaging to the Bodhi Browser extension:

```typescript
import { BodhiExtClient } from '@bodhiapp/bodhi-js-ext';

const extClient = new BodhiExtClient();
await extClient.init();
const result = await extClient.sendExtRequest('ping', {});
```

## Debugging

- Console prefix: `[Bodhi/Ext]` for extension SDK logs
- Use `logLevel: 'debug'` in client config or BodhiProvider
- Inspect service worker: `chrome://extensions` → Details → Inspect views
- Check `chrome.storage.session` for token state

## Key Source Files

- `bodhi-js-sdk/ext/src/` — ExtUIClient, BodhiExtClient, ExtClient, DirectExtClient
- `bodhi-js-sdk/react-ext/src/` — Extension BodhiProvider preset
- `bodhi-js-sdk/ext/CLAUDE.md` — Extension package architecture
