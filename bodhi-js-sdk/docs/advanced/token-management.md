# Advanced Token Management

Deep dive into OAuth 2.1 + PKCE implementation, manual token management, and JWT parsing internals.

> **Note**: Most applications don't need these internals - the SDK handles token management automatically. This guide is for advanced use cases requiring direct token manipulation or custom OAuth flows.

## Table of Contents

- [Token Storage Internals](#token-storage-internals)
- [Manual Token Refresh](#manual-token-refresh)
- [PKCE Flow Implementation](#pkce-flow-implementation)
- [JWT Token Parsing](#jwt-token-parsing)
- [OAuth Endpoint Construction](#oauth-endpoint-construction)
- [State Serialization](#state-serialization)

---

## Token Storage Internals

The SDK stores tokens automatically based on platform with specific key prefixes for isolation.

### Web Applications (localStorage)

```typescript
// Storage keys (web)
const KEYS = {
  ACCESS_TOKEN: 'bodhi:web:ACCESS_TOKEN',
  REFRESH_TOKEN: 'bodhi:web:REFRESH_TOKEN',
  EXPIRES_AT: 'bodhi:web:EXPIRES_AT',
  CODE_VERIFIER: 'bodhi:web:CODE_VERIFIER', // Temporary during OAuth flow
  STATE: 'bodhi:web:STATE', // Temporary during OAuth flow
};

// Store token
localStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
localStorage.setItem(KEYS.EXPIRES_AT, String(Date.now() + expiresIn * 1000));

// Retrieve token
const token = localStorage.getItem(KEYS.ACCESS_TOKEN);
const expiresAt = parseInt(localStorage.getItem(KEYS.EXPIRES_AT) || '0');
```

### Chrome Extensions (chrome.storage.session)

```typescript
// Storage keys (extension)
const KEYS = {
  ACCESS_TOKEN: 'bodhi:ext:ACCESS_TOKEN',
  REFRESH_TOKEN: 'bodhi:ext:REFRESH_TOKEN',
  EXPIRES_AT: 'bodhi:ext:EXPIRES_AT',
};

// Store token (async)
await chrome.storage.session.set({
  [KEYS.ACCESS_TOKEN]: accessToken,
  [KEYS.EXPIRES_AT]: Date.now() + expiresIn * 1000,
});

// Retrieve token (async)
const result = await chrome.storage.session.get([KEYS.ACCESS_TOKEN]);
const token = result[KEYS.ACCESS_TOKEN];
```

### Storage Prefix Constants

```typescript
import { STORAGE_PREFIXES } from '@bodhiapp/bodhi-js-core';

// Facade-level prefixes (user prefs)
console.log(STORAGE_PREFIXES.WEB); // 'bodhi-js-sdk:web'
console.log(STORAGE_PREFIXES.EXT); // 'bodhi-js-sdk:ext'

// Internal client prefixes (OAuth tokens)
console.log(STORAGE_PREFIXES.WEB_DIRECT); // 'bodhi-js-sdk:web:direct'
console.log(STORAGE_PREFIXES.WEB_EXT); // 'bodhi-js-sdk:web:ext'
console.log(STORAGE_PREFIXES.EXT_DIRECT); // 'bodhi-js-sdk:ext:direct'
console.log(STORAGE_PREFIXES.EXT_EXT); // 'bodhi-js-sdk:ext:ext'
```

---

## Manual Token Refresh

While the SDK automatically refreshes tokens, you can manually trigger refresh for custom flows.

### refreshAccessToken Utility

```typescript
import { refreshAccessToken, createOAuthEndpoints } from '@bodhiapp/bodhi-js-core';

const authServerUrl = 'https://id.getbodhi.app/realms/bodhi';
const endpoints = createOAuthEndpoints(authServerUrl);

try {
  const tokens = await refreshAccessToken(
    endpoints.token, // Token endpoint URL
    refreshToken, // Current refresh token
    'your-client-id' // OAuth client ID
  );

  console.log('New tokens:', tokens);
  // {
  //   access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  //   refresh_token: 'new-refresh-token',  // Optional
  //   id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  //   expires_in: 300  // Seconds
  // }
} catch (err) {
  console.error('Token refresh failed:', err);
}
```

### Token Refresh Response (OAuth Standard Format)

The function returns `RefreshTokenResponse` with snake_case fields (OAuth 2.0 standard):

```typescript
interface RefreshTokenResponse {
  access_token: string; // New JWT access token
  refresh_token?: string; // New refresh token (if rotated)
  id_token?: string; // New ID token with user claims
  expires_in: number; // Seconds until access token expires
}
```

### Implementing Custom Refresh Logic

```typescript
async function ensureValidToken(accessToken: string, refreshToken: string, expiresAt: number, clientId: string): Promise<string> {
  // Check if token expired
  if (Date.now() < expiresAt - 60000) {
    // 1 minute buffer
    return accessToken; // Still valid
  }

  // Refresh token
  const endpoints = createOAuthEndpoints('https://id.getbodhi.app/realms/bodhi');
  const tokens = await refreshAccessToken(endpoints.token, refreshToken, clientId);

  // Store new tokens (using snake_case fields from OAuth response)
  localStorage.setItem('bodhi:web:ACCESS_TOKEN', tokens.access_token);
  localStorage.setItem('bodhi:web:EXPIRES_AT', String(Date.now() + tokens.expires_in * 1000));

  if (tokens.refresh_token) {
    localStorage.setItem('bodhi:web:REFRESH_TOKEN', tokens.refresh_token);
  }

  return tokens.access_token;
}
```

---

## PKCE Flow Implementation

PKCE (Proof Key for Code Exchange) enhances OAuth security for browser-based apps by eliminating the need for client secrets.

### Code Verifier Generation

Generate a cryptographically random 32-byte code verifier:

```typescript
import { generateCodeVerifier } from '@bodhiapp/bodhi-js-core';

const verifier = generateCodeVerifier();
console.log(verifier);
// Example: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

// Store verifier (needed later for token exchange)
localStorage.setItem('bodhi:web:CODE_VERIFIER', verifier);
```

**Implementation**:

```typescript
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

### Code Challenge Generation

Generate SHA-256 hash of the verifier as code challenge:

```typescript
import { generateCodeChallenge } from '@bodhiapp/bodhi-js-core';

const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const challenge = await generateCodeChallenge(verifier);
console.log(challenge);
// Example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
```

**Implementation**:

```typescript
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}
```

### Authorization URL Construction

Build the OAuth authorization URL with PKCE parameters:

```typescript
const authServerUrl = 'https://id.getbodhi.app/realms/bodhi';
const clientId = 'your-client-id';
const redirectUri = 'http://localhost:3000/callback';
const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);
const state = crypto.randomUUID();

// Store for later
localStorage.setItem('bodhi:web:CODE_VERIFIER', verifier);
localStorage.setItem('bodhi:web:STATE', state);

// Build URL
const params = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'openid profile email scope_user_user',
  state: state,
  code_challenge: challenge,
  code_challenge_method: 'S256', // SHA-256
});

const authorizeUrl = `${authServerUrl}/protocol/openid-connect/auth?${params}`;

// Redirect user
window.location.href = authorizeUrl;
```

### Token Exchange with Verifier

Exchange authorization code for tokens using the original code verifier:

```typescript
const code = new URLSearchParams(window.location.search).get('code');
const verifier = localStorage.getItem('bodhi:web:CODE_VERIFIER');

const tokenResponse = await fetch(`${authServerUrl}/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier, // Proves possession of original verifier
  }),
});

const tokens = await tokenResponse.json();
// {
//   access_token: '...',
//   refresh_token: '...',
//   id_token: '...',
//   expires_in: 300,
//   token_type: 'Bearer'
// }

// Clear temporary storage
localStorage.removeItem('bodhi:web:CODE_VERIFIER');
localStorage.removeItem('bodhi:web:STATE');
```

---

## JWT Token Parsing

Parse and extract claims from JWT tokens without validation.

> **Warning**: These utilities decode tokens but do **not** validate signatures. Only use for extracting claims from tokens you've received from trusted sources.

### Parse Any JWT

```typescript
import { parseJwt } from '@bodhiapp/bodhi-js-core';

const accessToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const claims = parseJwt(accessToken);

console.log(claims);
// {
//   sub: '1234567890',
//   email: 'user@example.com',
//   exp: 1735689600,
//   iat: 1735686000,
//   aud: 'your-client-id',
//   scope: 'openid profile email scope_user_user'
// }
```

**Implementation**:

```typescript
function parseJwt(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}
```

### Extract UserInfo from ID Token

```typescript
import { extractUserInfo } from '@bodhiapp/bodhi-js-core';

const idToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const userInfo = extractUserInfo(idToken);

console.log(userInfo);
// {
//   sub: '1234567890',
//   email: 'user@example.com',
//   name: 'John Doe',
//   given_name: 'John',
//   family_name: 'Doe',
//   preferred_username: 'johndoe'
// }
```

### Check Token Expiration

```typescript
const claims = parseJwt(accessToken);
const expiresAt = claims.exp as number; // Unix timestamp (seconds)
const isExpired = Date.now() >= expiresAt * 1000;

if (isExpired) {
  console.log('Token expired, needs refresh');
} else {
  const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
  console.log(`Token valid for ${secondsLeft} seconds`);
}
```

---

## OAuth Endpoint Construction

Generate OAuth endpoint URLs from auth server base URL.

### createOAuthEndpoints Utility

```typescript
import { createOAuthEndpoints } from '@bodhiapp/bodhi-js-core';

const authServerUrl = 'https://id.getbodhi.app/realms/bodhi';
const endpoints = createOAuthEndpoints(authServerUrl);

console.log(endpoints);
// {
//   authorize: 'https://id.getbodhi.app/realms/bodhi/protocol/openid-connect/auth',
//   token: 'https://id.getbodhi.app/realms/bodhi/protocol/openid-connect/token',
//   revoke: 'https://id.getbodhi.app/realms/bodhi/protocol/openid-connect/revoke'
// }
```

### OAuthEndpoints Type

```typescript
interface OAuthEndpoints {
  authorize: string; // Authorization endpoint
  token: string; // Token endpoint
  revoke: string; // Token revocation endpoint
}
```

### Using Endpoints

```typescript
const endpoints = createOAuthEndpoints('https://id.getbodhi.app/realms/bodhi');

// Build authorization URL
const authUrl = `${endpoints.authorize}?${params}`;

// Exchange code for tokens
const tokenResponse = await fetch(endpoints.token, { method: 'POST', ... });

// Revoke token
const revokeResponse = await fetch(endpoints.revoke, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    token: accessToken,
    client_id: clientId,
  }),
});
```

---

## State Serialization

Serialize and deserialize client state for persistence across page reloads.

### Serializing Client State

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('client-id');
await client.init();

// Get current state
const state = client.getState();

// Serialize for storage
const serialized = JSON.stringify(state);
localStorage.setItem('bodhi:client-state', serialized);
```

### Deserializing Client State

```typescript
// Load from storage
const serialized = localStorage.getItem('bodhi:client-state');
const savedState = serialized ? JSON.parse(serialized) : undefined;

// Restore during init
const client = new WebUIClient('client-id');
await client.init({ savedState });

// Client restored to previous connection mode
```

### SerializedClientState Type

```typescript
type SerializedClientState = ExtensionState | DirectState;

interface ExtensionState {
  type: 'extension';
  extension: 'not-initialized' | 'not-found' | 'ready';
  extensionId: string | null;
  server: BackendServerState;
}

interface DirectState {
  type: 'direct';
  url: string | null;
  server: BackendServerState;
}

interface BackendServerState {
  status: ServerStatus;
  version: string | null;
  error: OperationErrorResponse | null;
}
```

---

## Best Practices

### 1. Token Security

```typescript
// ✅ DO use secure storage
localStorage.setItem('bodhi:web:ACCESS_TOKEN', token); // Same-origin protected

// ❌ DON'T expose tokens
console.log('Token:', accessToken); // Never log tokens
const url = `/api?token=${accessToken}`; // Never in URLs
```

### 2. Refresh Before Expiry

```typescript
// ✅ DO refresh with buffer
const BUFFER_MS = 60000; // 1 minute
if (Date.now() >= expiresAt - BUFFER_MS) {
  await refreshToken();
}

// ❌ DON'T wait for exact expiry
if (Date.now() >= expiresAt) {
  // Too late - requests may fail
}
```

### 3. Handle Refresh Failures

```typescript
try {
  const tokens = await refreshAccessToken(endpoint, refreshToken, clientId);
} catch (err) {
  // Refresh failed - re-authenticate
  await client.logout();
  await client.login();
}
```

### 4. Clear Sensitive Data

```typescript
// Always clear temporary PKCE data after use
localStorage.removeItem('bodhi:web:CODE_VERIFIER');
localStorage.removeItem('bodhi:web:STATE');

// Clear all tokens on logout
await client.logout(); // SDK handles this automatically
```

---

## Next Steps

- [Advanced Streaming Patterns](./streaming-internals.md) - Custom streaming implementation
- [Core Utilities](./core-utilities.md) - Direct core package access
- [API Reference](../api-reference.md) - Complete API documentation

---

← Back to [Authentication](../authentication.md) | Return to [Overview](../index.md)
