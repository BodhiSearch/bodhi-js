# Troubleshooting

## Connection Issues

### "Extension not found"

`clientState.status === 'extension-not-found'`

**Causes:**

- Bodhi Browser extension not installed
- Extension disabled in browser settings
- Browser doesn't support extensions (Safari, Firefox)

**Solutions:**

1. Call `showSetup()` to open the setup wizard — it guides extension installation
2. Check `chrome://extensions` for Bodhi Browser extension
3. Verify supported browser: Chrome, Edge, or Brave

### "Direct not connected"

`clientState.status === 'direct-not-connected'`

**Causes:**

- Bodhi App server not running
- Server URL misconfigured
- Chrome LNA (Local Network Access) not available (requires Chrome 130+)

**Solutions:**

1. Verify Bodhi App is running at `http://localhost:1135`
2. Check server health: `curl http://localhost:1135/bodhi/v1/info`
3. Direct mode is experimental — prefer extension mode

### Server status: 'not-reachable'

`clientState.server.status === 'not-reachable'`

- Server is down or unreachable at configured URL
- Check that Bodhi App is running
- Verify no firewall blocking localhost:1135

### Server status: 'setup'

`clientState.server.status === 'setup'`

- Server is installed but needs initial configuration
- The setup wizard handles this — call `showSetup()`

### Server status: 'resource_admin'

- Server requires admin to approve user access
- Use `client.requestAccess()` and `client.pollAccessRequestStatus()` to request and wait for approval

### All Server Status Values

For reference, `clientState.server.status` can be:

| Status                      | Meaning                   | `isServerReady` | Login works? |
| --------------------------- | ------------------------- | --------------- | ------------ |
| `'not-connected'`           | Not yet configured        | `false`         | No           |
| `'pending-extension-ready'` | Waiting for extension     | `false`         | No           |
| `'ready'`                   | Server operational        | `true`          | Yes          |
| `'setup'`                   | Needs initial setup       | `false`         | No           |
| `'resource_admin'`          | Needs admin approval      | `false`         | No           |
| `'error'`                   | Server error              | `false`         | No           |
| `'not-reachable'`           | Network error / wrong URL | `false`         | No           |

## Authentication Issues

### Login redirects but doesn't come back

**Causes:**

- `redirectUri` doesn't match registered URI at developer.getbodhi.app
- Using prod auth server (`id.getbodhi.app`) with localhost URI
- `handleCallback={false}` without custom callback handler

**Solutions:**

1. Verify `redirectUri` matches exactly what's registered (including trailing slashes)
2. For localhost development, use dev auth server: `https://main-id.getbodhi.app/realms/bodhi`
3. Ensure `handleCallback={true}` (default) or implement manual callback handling

### "auth.status === 'error'" after callback

- Check `auth.error.message` for details
- Common: PKCE state mismatch (user opened multiple login tabs)
- Common: Expired authorization code (took too long to redirect back)

### Token not included in API requests

- API methods like `client.chat.completions.create()` automatically include the token
- For `client.sendApiRequest()`, pass `authenticated: true` as the last parameter
- Verify `isAuthenticated` is true before making authenticated calls

### Login button doesn't work

- Check `canLogin` — it's `false` when `!isReady || isAuthLoading`
- Wait for `isReady` (client initialized) before allowing login
- Don't call `login()` while another auth operation is in progress

## Streaming Issues

### Stream hangs or never completes

**Causes:**

- Server disconnected mid-stream
- Extension service worker went idle (Chrome suspends after ~30s inactivity)

**Solutions:**

- Wrap stream in try/catch for clean error handling
- Extension mode has built-in port-based keep-alive; ensure extension is updated

### Stream returns empty chunks

- Normal behavior: some chunks have empty `delta.content`
- Filter: `const content = chunk.choices?.[0]?.delta?.content || '';`
- `finish_reason` will be `'stop'` on the final chunk

### "AbortError" during streaming

- User navigated away or component unmounted during stream
- Use `AbortController` for clean cancellation (if your app needs it)

## Console Log Prefixes

The SDK logs with these prefixes for debugging:

| Prefix               | Source                      |
| -------------------- | --------------------------- |
| `[Bodhi/Web]`        | Web SDK (WebUIClient)       |
| `[Bodhi/Ext]`        | Extension SDK (ExtUIClient) |
| `[Bodhi/background]` | Extension service worker    |
| `[Bodhi/content]`    | Extension content script    |
| `[Bodhi/inject]`     | Extension inject script     |

Set `logLevel: 'debug'` in BodhiProvider or client config to see verbose logs:

```tsx
<BodhiProvider authClientId="..." logLevel="debug">
```

## State Debugging

Inspect full state in a component:

```tsx
function DebugPanel() {
  const { clientState, auth, isOverallReady, isAuthenticated } = useBodhi();

  return (
    <pre>
      {JSON.stringify(
        {
          clientStatus: clientState.status,
          mode: clientState.mode,
          serverStatus: clientState.server.status,
          serverVersion: clientState.server.version,
          authStatus: auth.status,
          user: auth.user?.email,
          isOverallReady,
          isAuthenticated,
        },
        null,
        2
      )}
    </pre>
  );
}
```

For deeper introspection, use `client.debug()` — it returns internal state including connection details, token expiry, and extension info:

```tsx
const info = await client.debug();
console.log(JSON.stringify(info, null, 2));
```

## Error Handling

Errors use `instanceof` discrimination — there are no `isApiResult*` type guards:

```tsx
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

try {
  const result = await client.sendApiRequest('GET', '/bodhi/v1/info');
  const body = unwrapResponse(result); // throws BodhiApiError on status >= 400
} catch (err) {
  if (err instanceof BodhiApiError) {
    // HTTP error: err.status (number), err.body (response body), err.headers
    console.error('HTTP', err.status, err.body);
  } else if (err instanceof BodhiError) {
    // Operational error: err.code, err.message
    console.error('Operational', err.code, err.message);
  }
}
```
