# Authentication

Bodhi JS SDK uses OAuth2 + PKCE (Proof Key for Code Exchange) for secure authentication with the Bodhi identity server.

## Overview

The SDK provides built-in OAuth2 authentication with:

- **PKCE Flow**: Enhanced security for browser-based apps (no client secret needed)
- **Automatic Token Management**: Tokens stored securely in localStorage (web) or chrome.storage (extension)
- **Token Refresh**: Automatic refresh of expired access tokens
- **User Info Extraction**: JWT parsing for user details
- **Cross-Platform**: Works in both web apps and Chrome extensions

## Authentication Flow

The SDK implements OAuth2 + PKCE with automatic resource scope acquisition for server-specific token authorization:

```
┌─────────┐             ┌──────────┐             ┌──────────┐             ┌────────────┐
│  User   │             │ Your App │             │Bodhi App │             │ Auth Server│
└────┬────┘             └────┬─────┘             │  Server  │             └─────┬──────┘
     │                       │                   └────┬─────┘                   │
     │ 1. Click Login        │                        │                         │
     ├──────────────────────>│                        │                         │
     │                       │                        │                         │
     │                       │ 2. requestResourceAccess()                       │
     │                       ├───────────────────────>│                         │
     │                       │                        │                         │
     │                       │ 3. resource scope      │                         │
     │                       │    (scope_resource_    │                         │
     │                       │     abc123)            │                         │
     │                       │<───────────────────────┤                         │
     │                       │                        │                         │
     │                       │ 4. Generate PKCE verifier & challenge            │
     │                       │                        │                         │
     │                       │ 5. Construct full scope:                         │
     │                       │    openid profile email roles                    │
     │                       │    scope_user_user scope_resource_abc123         │
     │                       │                        │                         │
     │                       │ 6. Redirect to /authorize with full scope        │
     │                       ├─────────────────────────────────────────────────>│
     │                                                                           │
     │                       7. User authenticates                              │
     │<──────────────────────────────────────────────────────────────────────────┤
     │                                                                           │
     │                       8. Redirect to callback with code & state          │
     │                       │                        │                         │
     │──────────────────────>│                        │                         │
     │                       │                        │                         │
     │                       │ 9. Exchange code for tokens (+ PKCE verifier)    │
     │                       ├─────────────────────────────────────────────────>│
     │                       │                        │                         │
     │                       │ 10. Return tokens (includes resource scope)      │
     │                       │<─────────────────────────────────────────────────┤
     │                       │                        │                         │
     │                       │ 11. Store tokens & extract user info from JWT    │
     │                       │                        │                         │
     │ 12. Return to app     │                        │                         │
     │<──────────────────────┤                        │                         │
```

**What Happens**:

1. **Resource Scope Acquisition**: SDK calls Bodhi App Server to get server-specific scope (e.g., `scope_resource_abc123`)
2. **PKCE Security**: Generate code verifier/challenge for enhanced OAuth security
3. **Full Scope Construction**: Combine standard scopes (openid, profile, email, roles) + user scope + resource scope
4. **OAuth Flow**: Standard OAuth2 authorization code flow with PKCE
5. **Token Validation**: Returned tokens include resource scope, making them valid only for specific server instance

**Platform Differences**:

- **Web**: Browser redirects to callback URL (e.g., `http://localhost:3000/callback`)
- **Extension**: `chrome.identity.launchWebAuthFlow()` popup with Chrome-provided redirect URL

**Security Benefits**:

- **Server-Specific Tokens**: Each Bodhi App server has unique resource scope
- **Authorized Party Verification**: OAuth token explicitly includes server's resource scope
- **Multi-Tenant Security**: Different server instances require different resource scopes
- **Scope Validation**: Server verifies token contains its specific resource scope before processing requests

### Implementation Example

```typescript
// From @bodhiapp/bodhi-js/web/src/direct-client.ts (simplified)

async login(): Promise<AuthState> {
  // Step 1: Request resource access from Bodhi App server
  const result = await this.requestResourceAccess();
  const resourceScope = result.body.scope;  // e.g., "scope_resource_abc123"

  // Step 2: Construct full scope including resource scope
  const fullScope = `openid profile email roles ${this.userScope} ${resourceScope}`;
  //                                               ↑ user scope    ↑ resource scope
  //                                          (scope_user_user)  (scope_resource_abc123)

  // Step 3: Initiate OAuth with full scope
  const authUrl = new URL(this.authEndpoints.authorize);
  authUrl.searchParams.set('scope', fullScope);
  // ... rest of OAuth flow
}
```

### What This Means for Developers

**You don't need to do anything** - the SDK handles this automatically:

- ✅ Resource scope is automatically requested
- ✅ Full scope is automatically constructed
- ✅ OAuth flow includes the resource scope
- ✅ Tokens are automatically scoped to your server

The SDK ensures your OAuth tokens are only valid for accessing the specific Bodhi App backend you're connecting to.

## Configuring Authentication

### Web Client Configuration

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

// Minimal - uses sensible defaults
const client = new WebUIClient('your-client-id');

// With custom config
const client = new WebUIClient('your-client-id', {
  authServerUrl: 'https://custom-auth.example.com',
  userScope: 'scope_user_power_user',
  basePath: '/app',
});
```

**Configuration Options** (all optional):

| Option          | Type        | Default                                  | Description                              |
| --------------- | ----------- | ---------------------------------------- | ---------------------------------------- |
| `redirectUri`   | `string`    | Auto-computed from basePath              | OAuth callback URL                       |
| `authServerUrl` | `string`    | `'https://id.getbodhi.app/realms/bodhi'` | Keycloak auth server URL                 |
| `userScope`     | `UserScope` | `'scope_user_user'`                      | Requested user scope                     |
| `basePath`      | `string`    | `'/'`                                    | App base path for multi-tenant scenarios |

### Extension Client Configuration

```typescript
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('your-client-id');
```

> **Note**: Extension clients don't need `redirectUri` as they use `chrome.identity` API.

## Using Authentication

### Login

Initiate OAuth login flow:

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function LoginButton() {
  const { login, canLogin } = useBodhi();

  return (
    <button onClick={login} disabled={!canLogin}>
      Login with Keycloak
    </button>
  );
}
```

**What happens during login**:

1. Generate PKCE code verifier and challenge
2. Store verifier and state in localStorage
3. Redirect to authorization endpoint with challenge
4. User authenticates on Keycloak
5. Redirect back to app with authorization code
6. Exchange code for access/refresh tokens
7. Parse JWT to extract user info
8. Store tokens and update auth state

### Logout

Clear authentication and revoke tokens:

```typescript
function LogoutButton() {
  const { logout, isAuthenticated } = useBodhi();

  if (!isAuthenticated) return null;

  return <button onClick={logout}>Logout</button>;
}
```

**What happens during logout**:

1. Revoke tokens at auth server
2. Clear tokens from storage
3. Clear user info
4. Update auth state to 'unauthenticated'

### Checking Authentication Status

```typescript
const { isAuthenticated, auth } = useBodhi();

if (isAuthenticated) {
  console.log('User:', auth.user);
  console.log('Token:', auth.accessToken);
} else {
  console.log('Not authenticated');
}
```

## AuthState Structure

The SDK provides a flat `AuthState` interface:

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

### UserInfo Type

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

### AuthError Type

```typescript
interface AuthError {
  code: string; // Error code (e.g., 'invalid_grant')
  message: string; // Human-readable error message
}
```

### Helper Functions

The SDK provides utility functions to check auth state:

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

The SDK exports a constant for the initial auth state:

```typescript
import { INITIAL_AUTH_STATE } from '@bodhiapp/bodhi-js-core';

// INITIAL_AUTH_STATE = {
//   status: 'idle',
//   user: null,
//   accessToken: null,
//   error: null
// }
```

## User Scopes

The Bodhi App backend supports two user scopes with different privilege levels:

### scope_user_user (Default)

**Read-only/Inference-only access**:

- Can send chat completion requests
- Can list available models
- Can query server health
- **Cannot** download new models
- **Cannot** modify server configuration

**Use Cases**:

- General chat applications
- Inference-only applications
- Public-facing integrations

**Configuration**:

```typescript
// Default scope
const client = new WebUIClient('client-id');
```

### scope_user_power_user

**Extended privileges** (includes all scope_user_user + additional):

- All read-only/inference operations
- **Can** download new models
- **Can** manage model lifecycle
- Future: Additional administrative privileges

**Use Cases**:

- Developer tools
- Model management applications
- Administrative interfaces

**Configuration**:

```typescript
const client = new WebUIClient('client-id', {
  userScope: 'scope_user_power_user',
});
```

> **Note**: The actual scope granted depends on the Bodhi App server configuration. Even if you request `scope_user_power_user`, the server may only grant `scope_user_user` based on user permissions.

## Making Authenticated API Requests

Pass `authenticated: true` to automatically inject the access token:

```typescript
const { client } = useBodhi();

// Authenticated request (requires login)
const result = await client.sendApiRequest(
  'GET',
  '/v1/models',
  undefined,
  undefined,
  true // authenticated = true
);
```

**Token Injection**:
The SDK automatically adds the Authorization header:

```
Authorization: Bearer <access-token>
```

### Example: Protected Chat Endpoint

```typescript
async function sendChat(model: string, prompt: string) {
  const { client, isAuthenticated } = useBodhi();

  if (!isAuthenticated) {
    throw new Error('Authentication required');
  }

  // Will automatically include auth token
  const stream = client.streamChat(model, prompt, true);

  for await (const chunk of stream) {
    console.log(chunk.choices?.[0]?.delta?.content);
  }
}
```

## Token Management

The SDK automatically manages tokens for you:

- **Automatic Storage**: Tokens stored in localStorage (web) or chrome.storage.session (extension)
- **Automatic Refresh**: Expired tokens refreshed before API requests
- **Secure Handling**: PKCE flow for enhanced security

For most applications, you don't need to manage tokens manually. The SDK handles everything automatically.

> **Advanced**: For manual token management, PKCE internals, and direct token manipulation, see [Advanced Token Management](./advanced/token-management.md).

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
| `invalid_token`         | Token expired or malformed            | Refresh token or re-login     |

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
      {error && <Alert severity="error">{error}</Alert>}
      {auth.error && <Alert severity="error">{auth.error.message}</Alert>}
      <button onClick={handleLogin} disabled={isAuthLoading}>
        {isAuthLoading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  );
}
```

## Security Best Practices

### 1. Use HTTPS in Production

```typescript
// Development
redirectUri: 'http://localhost:3000/callback'; // OK for dev

// Production
redirectUri: 'https://yourapp.com/callback'; // MUST use HTTPS
```

### 2. Validate State Parameter

The SDK automatically generates and validates the `state` parameter to prevent CSRF attacks.

### 3. Store Tokens Securely

- Web: localStorage (same-origin policy protects)
- Extension: chrome.storage.session (extension-scoped)

> **Warning**: Never expose tokens in URLs, logs, or error messages.

### 4. Handle Token Expiry

Always check `isAuthenticated` before protected operations:

```typescript
if (!isAuthenticated) {
  await login();
}
```

### 5. Revoke Tokens on Logout

Always call `logout()` to revoke tokens at the auth server:

```typescript
// DON'T just clear local storage
localStorage.removeItem('ACCESS_TOKEN'); // ❌ Token still valid

// DO call logout to revoke
await client.logout(); // ✅ Revokes at server
```

## Testing Authentication

### Mock Authentication for Development

```typescript
// For testing without real OAuth
const mockClient = {
  ...client,
  login: async () => {
    // Simulate successful login
    setAuth({
      status: 'authenticated',
      user: { sub: '123', email: 'test@example.com', name: 'Test User', ... },
      accessToken: 'mock-token',
      error: null,
    });
  },
};
```

### Testing OAuth Callback

Visit your callback URL manually with a code:

```
http://localhost:3000/callback?code=test-code&state=test-state
```

The SDK will attempt to exchange the code (will fail with invalid code, but you can test the flow).

## Next Steps

- **[API Requests](./api-requests.md)** - Making authenticated API calls
- **[Streaming](./streaming.md)** - Streaming with authentication
- **[Error Handling](./error-handling.md)** - Handling auth errors

---

← Back to [React Integration](./react-integration.md) | Continue to [API Requests](./api-requests.md) →
