# Troubleshooting

## Connection Issues

### "Extension not found"

`clientState.status === 'extension-not-found'`

**Causes:**

- Bodhi Browser extension not installed
- Extension disabled in browser settings
- Browser doesn't support extensions (Safari, Firefox)

**Solutions:**

1. The default `setup-modal-v2` is direct-mode only and does NOT guide extension install. For extension-mode apps, use `setupModal="setup-modal"` (legacy wizard) or your own UI to drive `client.setConnectionMode('extension')`
2. Check `chrome://extensions` for Bodhi Browser extension
3. Verify supported browser: Chrome, Edge, or Brave

### "Direct not connected"

`clientState.status === 'direct-not-connected'`

**Causes:**

- Bodhi App server not running
- Server URL misconfigured
- Chrome LNA (Local Network Access) not available (requires Chrome 130+)

**Solutions:**

1. Call `showSetup()` to open the setup modal — it lets the user enter a server URL and verify connectivity
2. Verify Bodhi App is running at `http://localhost:1135`
3. Check server health: `curl http://localhost:1135/bodhi/v1/info`

### Server status: 'not-reachable'

`clientState.server.status === 'not-reachable'`

- Server is down or unreachable at configured URL
- Call `showSetup()` �� the setup modal shows the error and lets the user enter a different URL or retry
- Verify Bodhi App is running and no firewall is blocking the port

### Server status: 'setup'

`clientState.server.status === 'setup'`

- Server is installed but needs initial configuration
- Call `showSetup()` — the modal shows "not-ready" status with a Refresh button so the user can complete setup in the Bodhi App UI and retry

### Server status: 'resource_admin'

- Server requires an admin to approve user access in the Bodhi App UI
- Once the admin approves the user, `login()` succeeds normally

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

## Grant / Access Issues

Access is **fail-closed**: the login request only decides which controls the consent screen renders — the owner still has to grant each resource. Anything the owner doesn't explicitly grant (models/MCPs default to All=off, Specific=empty) is denied.

### Chat/inference returns 403 `token_grant_error-model_forbidden`

- The token has no grant for that model. Requesting `models_access: true` renders the model selector, but the owner must actually pick **All models** or add the **specific** model on the review page.
- Fix: re-run `login({ requested: { models_access: true, ... } })` and have the owner grant the model (or request a specific `mcp_servers`/model you know they'll approve).

### `/v1/models` is empty or a model is "not found" (404 `alias_not_found`)

- Same root cause as above from the list side: only granted models are listed (plus non-granted ones if the owner enabled the `models_list` toggle). An empty grant ⇒ empty list ⇒ chat can't resolve the alias.
- Confirm the granted model id (including any provider prefix, e.g. `oai/gpt-4.1-nano`) matches what you send to `chat.completions.create()`.

### MCP connect/tool call returns 403 `token_grant_error-mcp_forbidden`

- The owner didn't grant that MCP. Requesting it via `mcp_servers: [{ url }]` shows it on the consent screen; the owner must bind it to one of their MCP instances and approve. `mcps_access` covers owner-extra instances beyond your requested URLs.
- A direct `GET /bodhi/v1/apps/mcps/{id}` for an ungranted MCP returns **404** (existence is hidden), not 403.

### Calls suddenly start failing with 401

- The owner revoked the app's access. Revocation takes effect immediately (the cached token exchange is evicted). Surface a re-authorization path that re-runs the `login()` request/approval flow.

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
