# Core Utilities

Direct access to core package exports for advanced use cases.

> **Note**: Most applications use the preset packages and don't need to import from `@bodhiapp/bodhi-js-core` directly. This guide covers utilities available for advanced scenarios.

## Error Classes

The SDK uses two error classes for structured error handling:

```typescript
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-core';

// BodhiError — operational errors (network, extension, timeout)
// BodhiApiError extends BodhiError — HTTP 4xx/5xx errors

try {
  await someOperation();
} catch (err) {
  if (err instanceof BodhiApiError) {
    // HTTP error with status code and body
    console.error('API error:', err.status, err.body);
  } else if (err instanceof BodhiError) {
    // Operational error
    console.error('Operation error:', err.message);
  }
}
```

## unwrapResponse

Throws `BodhiApiError` when the HTTP response status is >= 400:

```typescript
import { unwrapResponse } from '@bodhiapp/bodhi-js-core';

const result = await client.sendApiRequest('GET', '/bodhi/v1/info');
const body = unwrapResponse(result); // throws BodhiApiError if status >= 400
```

Use this in custom wrappers around `sendApiRequest` when you want throw semantics rather than `ApiResponseResult` discrimination.

## Type Guards

```typescript
import { isExtensionState, isDirectState, isClientReady, isServerReady, isAuthenticated, isAuthLoading, isAuthError, isWebUIClient } from '@bodhiapp/bodhi-js-core';

// Client state narrowing
const state = client.getState();
if (isExtensionState(state)) {
  console.log('Extension ID:', state.extensionId);
}
if (isDirectState(state)) {
  console.log('Server URL:', state.url);
}

// Readiness checks
if (isClientReady(state)) {
  // Extension ready OR direct URL configured
}
if (isServerReady(state.server)) {
  // server.status === 'ready'
}

// Auth state checks
const auth = client.getAuthState();
if (isAuthenticated(auth)) {
  console.log('User:', auth.user);
}
if (isAuthLoading(auth)) {
  console.log('Auth in progress');
}
if (isAuthError(auth)) {
  console.error('Auth error:', auth.error);
}

// Client interface narrowing
if (isWebUIClient(client)) {
  // client is IWebUIClient — has handleOAuthCallback
  await client.handleOAuthCallback(new URL(window.location.href).searchParams);
}
```

## INITIAL_AUTH_STATE

Constant for the initial unauthenticated auth state:

```typescript
import { INITIAL_AUTH_STATE } from '@bodhiapp/bodhi-js-core';

// Use as default value where AuthState is needed
const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH_STATE);
// { status: 'unauthenticated', user: null, accessToken: null, error: null, ... }
```

## LoginOptionsBuilder

Fluent builder for constructing login options:

```typescript
import { LoginOptionsBuilder } from '@bodhiapp/bodhi-js-core';

const loginOptions = new LoginOptionsBuilder()
  .setRole('scope_user_power_user')
  .setMcps()
  .build();

await client.login(loginOptions);
```

## Platform Detection

Platform utilities from `platform.ts` (based on ua-parser-js):

```typescript
import { detectPlatform, getPlatformInfo } from '@bodhiapp/bodhi-js-core';

const platform = detectPlatform();
// { browser: 'Chrome', os: 'macOS', ... }

const info = getPlatformInfo();
// Used internally by setup modal for compatibility checks
```

## Related Documentation

- **[Error Handling](../error-handling.md)** - Complete error handling guide
- **[Authentication](../authentication.md)** - Auth state and OAuth flow
- **[API Reference](../api-reference.md)** - Complete API documentation

---

← Back to [Overview](../index.md)
