---
name: bodhi-sdk-extension
description: >
  Build Chrome extensions with bodhi-js-sdk extension packages. Use for @bodhiapp/bodhi-js-ext,
  @bodhiapp/bodhi-js-react-ext, chrome.runtime messaging, chrome.identity auth, or extension-specific patterns.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm:*), Bash(npx:*)
---

# Bodhi JS SDK — Chrome Extension Development

Guide for building Chrome extensions that connect to Bodhi App using the extension-specific SDK packages. These packages use `chrome.runtime` messaging and `chrome.identity` for auth instead of the web SDK's `window.bodhiext` and browser redirects.

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

  // Same useBodhi() API as web — see bodhi-sdk skill for full hook reference
  // Key difference: auth uses chrome.identity, not browser redirects

  if (!isOverallReady) return <div>Connecting to Bodhi...</div>;
  if (!isAuthenticated) return <button onClick={() => login()}>Login</button>;

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

The extension SDK uses three internal client types (the `ExtUIClient` facade manages them):

1. **BodhiExtClient** — Communicates with the bodhi-browser-ext extension via `chrome.runtime.sendMessage()` to the Bodhi Browser extension ID
2. **ExtClient** — Communicates with your own extension's background script via internal `chrome.runtime` messaging
3. **DirectExtClient** — Direct HTTP fallback (same as web direct mode)

`ExtUIClient` wraps these and switches between them based on connection mode, just like `WebUIClient` does on the web side.

### Auth via chrome.identity

```typescript
// Extension OAuth uses popup-based auth (no redirect)
chrome.identity.launchWebAuthFlow(
  {
    url: authorizationUrl,
    interactive: true,
  },
  redirectUrl => {
    // Extract code from redirectUrl, exchange for tokens
  }
);
```

This happens automatically when you call `login()` — no configuration needed beyond `authClientId`.

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

The `identity` permission enables `chrome.identity.launchWebAuthFlow()`. The `storage` permission enables `chrome.storage.session` for token persistence.

## Vanilla JS Extension

For background scripts or non-React extension code:

```typescript
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('your-client-id', {
  authServerUrl: 'https://main-id.getbodhi.app/realms/bodhi',
  logLevel: 'debug',
});

await client.init();

// Same client API as web — chat, models, embeddings, etc.
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

If your extension needs to communicate with the Bodhi Browser extension directly (not through the SDK facade):

```typescript
import { BodhiExtClient } from '@bodhiapp/bodhi-js-ext';

// Direct messaging to bodhi-browser-ext
const extClient = new BodhiExtClient();
await extClient.init();

// Send extension-to-extension request
const result = await extClient.sendExtRequest('ping', {});
```

## Key Differences in State

Extension mode adds `extensionId` to the client state:

```tsx
const { clientState } = useBodhi();

if (clientState.mode === 'extension') {
  console.log('Connected to Bodhi Browser:', clientState.extensionId);
}
```

## Debugging Extension SDK

- Console prefix: `[Bodhi/Ext]` for extension SDK logs
- Use `logLevel: 'debug'` in client config or BodhiProvider
- Inspect extension service worker: `chrome://extensions` → Details → Inspect views
- Check `chrome.storage.session` for token state: DevTools → Application → Session Storage

## Key Source Files

- `bodhi-js-sdk/ext/src/` — ExtUIClient, BodhiExtClient, ExtClient, DirectExtClient
- `bodhi-js-sdk/react-ext/src/` — Extension BodhiProvider preset
- `bodhi-js-sdk/ext/CLAUDE.md` — Extension package architecture details
- `bodhi-js-sdk/react-ext/CLAUDE.md` — React extension bindings details
