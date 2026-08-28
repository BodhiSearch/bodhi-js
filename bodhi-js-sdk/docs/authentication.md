# Authentication

Bodhi SDK uses a standard OAuth2 authorization-code flow with PKCE, entered through BodhiApp's consent page. The flow: navigate the user to the consent page, the user grants access, Keycloak returns the authorization code, and the SDK exchanges it for tokens.

## Overview

The SDK provides built-in OAuth2 authentication with:

- **Consent-Page Flow**: The user reviews and grants access (models, MCPs, role) on BodhiApp's consent page
- **PKCE Security**: Enhanced security for browser-based apps (no client secret needed)
- **Automatic Token Management**: Tokens stored securely in localStorage (web) or chrome.storage.session (extension)
- **Token Refresh**: Automatic refresh of expired access tokens with race condition prevention
- **User Info Extraction**: JWT parsing for user details
- **Cross-Platform**: Works in both web apps and Chrome extensions

## Login Flow

The `login()` method orchestrates the entire consent + OAuth flow automatically:

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function LoginButton() {
  const { login } = useBodhi();

  // Simple login (no special access)
  const handleLogin = () => login();

  return <button onClick={handleLogin}>Login</button>;
}
```

### Login with Options

```typescript
const { login } = useBodhi();

// Login with options
await login({
  role: 'scope_user_power_user',
  mcps: true,
  onProgress: stage => setLoginStage(stage),
});
```

**What happens during login**:

1. SDK composes the scope string from the options (base OAuth scopes + role token + `scope_apps:*` flags + `extraScopes`)
2. SDK generates PKCE + state and navigates the user to `${serverUrl}/ui/apps/auth/` with the standard OAuth params
3. User reviews the request on BodhiApp's consent page and grants access (which models/MCPs, what role)
4. On approve, BodhiApp composes the Keycloak authorize URL; Keycloak SSO redirects back to the registered `redirect_uri` with `code` + `state`
5. SDK exchanges the authorization code for tokens at Keycloak's token endpoint
6. Tokens are stored and user info is extracted from the JWT

On deny (or a redirectable request error such as an invalid scope), BodhiApp redirects back with `error`, `error_description`, `error_source=bodhi`, and the original `state`; the SDK surfaces this as an auth error (`access_request_denied` for a deny). An unknown client or unregistered `redirect_uri` renders an error on the consent page itself — no redirect reaches the app.

## LoginOptions Interface

```typescript
interface LoginOptions {
  role?: UserScope; // Role ceiling requested (default: 'scope_user_user')
  llms?: boolean; // Model access section: undefined → requested, false → suppressed
  mcps?: boolean; // MCP access section: undefined → requested, false → suppressed
  reauthorize?: boolean; // Re-consent with prefill while already authenticated
  extraScopes?: string[]; // Scope tokens forwarded verbatim to Keycloak (passthrough)
  onProgress?: LoginProgressCallback; // Progress stage callback
}

type LoginProgressStage = 'reviewing' | 'authenticating';
type LoginProgressCallback = (stage: LoginProgressStage) => void;

type UserScope = 'scope_user_user' | 'scope_user_power_user';
```

`llms: false` and `mcps: false` together form a valid role-only request — the consent page shows a summary instead of grant sections. `extraScopes` must not include `scope_access_request:*` (reserved for server-side composition; rejected with `invalid_scope`).

### Progress Stages

Use `onProgress` to track login progress and update your UI:

```typescript
const [stage, setStage] = useState<string>('');

await login({
  onProgress: stage => {
    setStage(stage);
    // 'reviewing'      - Navigating to the consent page
    // 'authenticating' - Code exchange in progress (extension/chrome.identity flow only;
    //                    the web flow full-page-redirects at 'reviewing')
  },
});
```

## Reauthorize (Re-consent While Authenticated)

Calling `login()` while authenticated is a no-op by default. To request more access mid-session, pass `reauthorize: true`: the SDK reads the `access_request_id` claim from the current access token and sends it as `source_access_request_id`, so the consent page pre-populates from the existing grant (with a reauthorization banner). Approval replaces the stored tokens; prior grants stay live; a deny leaves the existing tokens untouched.

```typescript
await login({ reauthorize: true, role: 'scope_user_power_user' });
```

## PKCE Flow

The SDK implements OAuth2 + PKCE (Proof Key for Code Exchange) for secure browser-based authentication without client secrets.

1. **Generate PKCE pair**: SDK creates a random code verifier and computes its SHA-256 challenge
2. **Consent + authorization**: Navigates to BodhiApp's consent page with the challenge; on approve BodhiApp redirects through Keycloak's `/authorize`
3. **User authenticates**: Keycloak SSO (the consent page already required a BodhiApp session)
4. **Code exchange**: SDK exchanges the authorization code + original verifier for tokens
5. **Token storage**: Tokens stored in localStorage (web) or chrome.storage.session (extension)

**Auth server**: `https://id.getbodhi.app/realms/bodhi`

> **Advanced**: For PKCE internals, code verifier/challenge generation, and manual OAuth flows, see [Advanced Token Management](./advanced/token-management.md).

## Callback Handling

After OAuth authentication, the auth server redirects back to your application with an authorization code.

### Automatic (Default)

`BodhiProvider` handles callbacks automatically when `handleCallback` is `true` (the default):

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

// Callbacks handled automatically at {basePath}/callback
<BodhiProvider authClientId="your-client-id" handleCallback={true}>
  <App />
</BodhiProvider>
```

### Manual

For custom callback handling, use the client methods directly. These methods are available on web clients only (`IWebUIClient`); use the `isWebUIClient` type guard before calling them:

```typescript
import { useBodhi, isWebUIClient } from '@bodhiapp/bodhi-js-react';

const { client } = useBodhi();

if (isWebUIClient(client)) {
  // Handle the OAuth callback (code exchange, or deny/error classification — throws BodhiError)
  await client.handleOAuthCallback(new URL(window.location.href).searchParams);
}
```

The callback URL defaults to `{basePath}/callback` (e.g., `http://localhost:3000/callback`).

## AuthState

The SDK provides a flat `AuthState` interface for tracking authentication status:

```typescript
interface AuthState {
  status: AuthStatus; // Current auth status
  user: UserInfo | null; // User details (when authenticated)
  accessToken: string | null; // JWT access token (when authenticated)
  error: AuthError | null; // Error details (when status === 'error')
  refreshToken: string | null; // Refresh token (when authenticated)
  expiresAt: number | null; // Token expiry timestamp in ms (when authenticated)
  isTokenRefresh: boolean; // True when a background token refresh is in progress
}

type AuthStatus =
  | 'idle' // Initial state
  | 'loading' // Auth operation in progress
  | 'authenticated' // Successfully authenticated
  | 'unauthenticated' // Not authenticated
  | 'error'; // Auth error occurred
```

### UserInfo

```typescript
interface UserInfo {
  sub: string; // Subject (user ID)
  email: string; // Email address
  name: string; // Full name
  given_name: string; // First name
  family_name: string; // Last name
  preferred_username: string; // Username
}
```

### AuthError

```typescript
interface AuthError {
  code: string; // Error code (e.g., 'invalid_grant')
  message: string; // Human-readable error message
}
```

### Checking Auth Status

```typescript
const { isAuthenticated, auth } = useBodhi();

if (isAuthenticated) {
  console.log('User:', auth.user);
  console.log('Token:', auth.accessToken);
} else {
  console.log('Not authenticated');
}
```

### Helper Functions

```typescript
import { isAuthenticated, isAuthLoading, isAuthError } from '@bodhiapp/bodhi-js-core';

const auth = client.getAuthState();

if (isAuthenticated(auth)) {
  console.log('User is authenticated:', auth.user);
}

if (isAuthLoading(auth)) {
  console.log('Authentication in progress...');
}

if (isAuthError(auth)) {
  console.log('Authentication error:', auth.error);
}
```

### Initial Auth State

```typescript
import { INITIAL_AUTH_STATE } from '@bodhiapp/bodhi-js-core';

// INITIAL_AUTH_STATE = {
//   status: 'idle',
//   user: null,
//   accessToken: null,
//   error: null,
//   refreshToken: null,
//   expiresAt: null,
//   isTokenRefresh: false
// }
```

## Token Management

The SDK automatically manages tokens:

- **Automatic Refresh**: Expired tokens refreshed before API requests with a 5-second expiration buffer
- **Race Condition Prevention**: Single refresh promise prevents concurrent refresh attempts
- **Auto-Logout on `invalid_grant`**: If token refresh fails with `invalid_grant`, the SDK automatically logs out
- **Automatic Injection**: Access tokens are automatically added as `Authorization: Bearer` headers on authenticated API calls

For most applications, you do not need to manage tokens manually.

> **Advanced**: For manual token management, PKCE internals, and storage key details, see [Advanced Token Management](./advanced/token-management.md).

## Logout

Revoke tokens and clear authentication state:

```typescript
const { logout } = useBodhi();

await logout(); // Revokes tokens at auth server + clears local storage
```

**What happens during logout**:

1. Revoke tokens at the auth server
2. Clear tokens from storage
3. Clear user info
4. Update auth state to `'unauthenticated'`

Always call `logout()` rather than clearing storage manually -- the SDK ensures tokens are revoked server-side.

## State Callback

Monitor auth and client state changes programmatically:

```typescript
client.setStateCallback(change => {
  if (change.type === 'auth-state') {
    console.log('Auth state changed:', change.state);
  }
  if (change.type === 'client-state') {
    console.log('Client state changed:', change.state);
  }
});
```

The callback receives a discriminated union:

```typescript
type StateChange = { type: 'client-state'; state: ClientState } | { type: 'auth-state'; state: AuthState };

type StateChangeCallback = (change: StateChange) => void;
```

## Error Handling

### Authentication Errors

```typescript
const { auth } = useBodhi();

if (auth.status === 'error') {
  console.error('Auth error:', auth.error);
  // auth.error = { code: 'invalid_grant', message: '...' }
}
```

### Common Error Codes

| Code                    | Cause                                                       | Solution                              |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------- |
| `access_request_denied` | User denied the request on the consent page                 | Ask the user to grant access          |
| `access_request_failed` | Redirected error (e.g. `invalid_scope`) or invalid callback | Check the message for the cause       |
| `auth_error`            | State mismatch on the code callback (CSRF protection)       | Retry login                           |
| `invalid_grant`         | Code expired or already used                                | Retry login                           |

An unknown client or unregistered `redirect_uri` never reaches the app — BodhiApp renders the error on the consent page, so the app-side symptom is a login that never completes.

### Handling Failed Authentication

```typescript
function LoginFlow() {
  const { login, auth, isAuthLoading } = useBodhi();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {auth.error && <div className="error">{auth.error.message}</div>}
      <button onClick={handleLogin} disabled={isAuthLoading}>
        {isAuthLoading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  );
}
```

## User Scopes

Apps can request one of two user scopes as their role ceiling:

### scope_user_user (Default)

Read-only/inference-only access:

- Can send chat completion requests
- Can list available models
- Can query server health
- Cannot download new models
- Cannot modify server configuration

```typescript
// Default scope -- no configuration needed
const { login } = useBodhi();
await login();
```

### scope_user_power_user

Extended privileges (includes all `scope_user_user` permissions plus):

- Can download new models
- Can manage model lifecycle

```typescript
await login({ role: 'scope_user_power_user' });
```

> **Note**: The requested role is a ceiling, not a guarantee. When `scope_user_power_user` is requested, the consent page shows a downgrade selector — the approving user can grant `scope_user_user` instead, and can never grant above their own role.

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Getting Started](./integration/getting-started.md)** - Integration guide
- **[Advanced Token Management](./advanced/token-management.md)** - PKCE internals, manual token operations

---

← Back to [Getting Started](./integration/getting-started.md) | Continue to [API Reference](./api-reference.md) →
