# Authentication

Bodhi SDK uses OAuth2 + PKCE with an access-request-based login flow. The flow: create an access request, poll for approval, authenticate via OAuth, and receive tokens.

## Overview

The SDK provides built-in OAuth2 authentication with:

- **Access-Request Flow**: Create an access request, wait for approval, then authenticate
- **PKCE Security**: Enhanced security for browser-based apps (no client secret needed)
- **Automatic Token Management**: Tokens stored securely in localStorage (web) or chrome.storage.session (extension)
- **Token Refresh**: Automatic refresh of expired access tokens with race condition prevention
- **User Info Extraction**: JWT parsing for user details
- **Cross-Platform**: Works in both web apps and Chrome extensions

## Login Flow

The `login()` method orchestrates the entire access-request + OAuth flow automatically:

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
  userRole: 'scope_user_power_user',
  requested: { mcp_servers: [{ url: 'http://localhost:3000/mcp' }] },
  onProgress: stage => setLoginStage(stage),
  flowType: 'redirect',
});
```

**What happens during login**:

1. SDK builds an access request with the specified options
2. POST to `/bodhi/v1/apps/request-access` creates a draft request
3. SDK polls for approval (every 2s, up to 5 minutes)
4. Once approved, SDK initiates OAuth2 + PKCE flow
5. User authenticates on Keycloak
6. SDK exchanges the authorization code for tokens
7. Tokens are stored and user info is extracted from the JWT

## LoginOptions Interface

```typescript
interface LoginOptions {
  userRole?: UserScope; // 'scope_user_user' (default) | 'scope_user_power_user'
  requested?: RequestedResources; // Resources to request access to
  flowType?: FlowType; // 'redirect' | 'popup'
  redirectUrl?: string; // Custom redirect URL for OAuth callback
  onProgress?: LoginProgressCallback; // Progress stage callback
  pollIntervalMs?: number; // default 2000ms
  pollTimeoutMs?: number; // default 300000ms (5 min)
}

type LoginProgressStage = 'requesting' | 'reviewing' | 'authenticating';
type LoginProgressCallback = (stage: LoginProgressStage) => void;

type RequestedResources = {
  mcp_servers?: Array<{ url: string }>;
};

type UserScope = 'scope_user_user' | 'scope_user_power_user';
type FlowType = 'redirect' | 'popup';
```

### Progress Stages

Use `onProgress` to track login progress and update your UI:

```typescript
const [stage, setStage] = useState<string>('');

await login({
  onProgress: stage => {
    setStage(stage);
    // 'requesting'     - Creating access request
    // 'reviewing'      - Waiting for admin approval
    // 'authenticating' - OAuth flow in progress
  },
});
```

## Access Request Lifecycle

The login flow begins with an access request that must be approved before authentication proceeds.

### Flow

1. **Create Request**: `requestAccess(body)` sends POST to `/bodhi/v1/apps/request-access`, returns `{ id, status: 'draft' }`
2. **Poll for Status**: `pollAccessRequestStatus(id)` polls GET `/bodhi/v1/apps/access-requests/{id}` every 2 seconds
3. **Status Transitions**: `'draft'` transitions to `'approved'`, `'denied'`, `'failed'`, or `'expired'`
4. **On Approved**: SDK proceeds to OAuth authentication automatically

### Access Request Builder

The SDK uses an internal `AccessRequestBuilder` to construct the request body:

```typescript
// Internal flow (handled automatically by login()):
const builder = new AccessRequestBuilder(appClientId)
  .flowType('redirect')
  .requestedRole('scope_user_power_user')
  .requested({ mcp_servers: [{ url: 'http://localhost:3000/mcp' }] });

const body = builder.build();
```

### Polling Configuration

```typescript
await login({
  pollIntervalMs: 3000, // Poll every 3 seconds (default: 2000)
  pollTimeoutMs: 600000, // Wait up to 10 minutes (default: 300000)
});
```

## PKCE Flow

The SDK implements OAuth2 + PKCE (Proof Key for Code Exchange) for secure browser-based authentication without client secrets.

1. **Generate PKCE pair**: SDK creates a random code verifier and computes its SHA-256 challenge
2. **Authorization request**: Redirects to Keycloak `/authorize` endpoint with the challenge
3. **User authenticates**: User logs in on the Keycloak login page
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

For custom callback handling, use the client methods directly:

```typescript
const { client } = useBodhi();

// Handle OAuth authorization code callback
await client.handleOAuthCallback(code, state);

// Handle access request callback (resume polling after redirect)
await client.handleAccessRequestCallback(requestId);
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
//   error: null
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

| Code                    | Cause                                 | Solution                      |
| ----------------------- | ------------------------------------- | ----------------------------- |
| `invalid_grant`         | Code expired or already used          | Retry login                   |
| `invalid_client`        | Client ID not recognized              | Check client configuration    |
| `redirect_uri_mismatch` | Redirect URI doesn't match registered | Update redirect URI in config |
| `access_denied`         | User denied authorization             | Ask user to grant permission  |

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

The Bodhi App backend supports two user scopes:

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
await login({ userRole: 'scope_user_power_user' });
```

> **Note**: The actual scope granted depends on Bodhi App server configuration. The server may only grant `scope_user_user` based on user permissions, even if `scope_user_power_user` is requested.

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Getting Started](./integration/getting-started.md)** - Integration guide
- **[Advanced Token Management](./advanced/token-management.md)** - PKCE internals, manual token operations

---

← Back to [Getting Started](./integration/getting-started.md) | Continue to [API Reference](./api-reference.md) →
