# Client Injection (Dependency Injection Pattern)

This guide covers advanced scenarios where you need custom client configuration instead of using the simplified preset packages.

## When to Use Client Injection

Most applications should use the preset packages (`@bodhiapp/bodhi-js-react` or `@bodhiapp/bodhi-js-react-ext`). Consider using dependency injection when:

| Scenario                     | Why DI?                               | Example                                  |
| ---------------------------- | ------------------------------------- | ---------------------------------------- |
| **Multi-tenant apps**        | Different basePath per tenant         | SaaS with per-tenant storage isolation   |
| **Testing**                  | Mock clients for unit tests           | Jest tests with fake UIClient            |
| **Path-based deployments**   | Custom basePath for storage namespace | GitHub Pages at user.github.io/repo-name |
| **Advanced OAuth**           | Custom redirect URIs or scopes        | Enterprise SSO integration               |
| **Client lifecycle control** | Manual client creation/destruction    | Dynamic client switching                 |

**If your use case isn't listed above, use the preset packages** for simpler code.

---

## Package Comparison

| Package                         | Client Creation                | Props          | Best For                  |
| ------------------------------- | ------------------------------ | -------------- | ------------------------- |
| `@bodhiapp/bodhi-js-react`      | **Auto** (creates WebUIClient) | `authClientId` | Web apps (90% of cases)   |
| `@bodhiapp/bodhi-js-react-ext`  | **Auto** (creates ExtUIClient) | `authClientId` | Extensions (90% of cases) |
| `@bodhiapp/bodhi-js-react-core` | **Manual** (you create client) | `client` prop  | Advanced/custom scenarios |

---

## Using react-core with Dependency Injection

### Installation

```bash
# Web apps
npm install @bodhiapp/bodhi-js-react-core @bodhiapp/bodhi-js

# Chrome extensions
npm install @bodhiapp/bodhi-js-react-core @bodhiapp/bodhi-js-ext
```

### Basic Pattern (Web)

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import { WebUIClient } from '@bodhiapp/bodhi-js';

function App() {
  // Create client manually with custom OAuth callback
  const client = new WebUIClient('my-app', {
    redirectUri: 'https://myapp.com/oauth/callback',
  });

  return (
    <BodhiProvider client={client}>
      <MyComponents />
    </BodhiProvider>
  );
}
```

### Basic Pattern (Extension)

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

function ExtensionUI() {
  // Create client manually with custom logging
  const client = new ExtUIClient('my-extension', {
    logLevel: 'debug',
  });

  return (
    <BodhiProvider client={client}>
      <ExtensionComponents />
    </BodhiProvider>
  );
}
```

---

## WebUIClient Configuration (Web Apps)

### Interface

```typescript
interface WebUIClientParams {
  redirectUri?: string; // OAuth redirect (default: window.location.origin + '/oauth/callback')
  authServerUrl?: string; // OAuth server (default: 'https://id.getbodhi.app')
  userRole?: string; // OAuth scope (default: 'scope_user_user')
  basePath?: string; // Backend URL (default: 'http://localhost:1135')
  logLevel?: LogLevel; // Logging (default: LogLevel.Info)
  initParams?: {
    extension?: {
      timeoutMs?: number; // Extension detection timeout (default: 5000)
      intervalMs?: number; // Extension poll interval (default: 100)
    };
  };
}
```

### Common Use Cases

#### Custom Redirect URI

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('my-app', {
  redirectUri: 'https://app.example.com/auth/complete',
});
```

#### Multi-Tenant with basePath

For multi-tenant apps or apps deployed to paths (e.g., GitHub Pages: `user.github.io/repo-name`), use `basePath` to create storage isolation:

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

function createClientForTenant(tenantId: string) {
  return new WebUIClient('my-app', {
    basePath: `/tenant/${tenantId}`, // Creates namespaced storage keys
  });
}

// Usage
const client = createClientForTenant('acme-corp');
// Storage keys: /tenant/acme-corp:bodhi-js-sdk:web:CONNECTION_MODE
```

**Why basePath?**

- GitHub Pages deploys repos to `user.github.io/repo-name` (path-based, same domain)
- Browser's localStorage is domain-isolated, not path-isolated
- basePath creates custom namespace isolation for path-based deployments

See [Multi-Tenant Patterns](./multi-tenant.md) for complete details.

#### Custom Backend URL

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('my-app', {
  basePath: 'https://llm-server.corp.internal:8080',
});
```

#### Debug Logging

```typescript
import { WebUIClient, LogLevel } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('my-app', {
  logLevel: LogLevel.Debug, // Verbose logging for development
});
```

---

## ExtUIClient Configuration (Extensions)

### Interface

```typescript
interface ExtUIClientParams {
  authServerUrl?: string; // OAuth server (default: 'https://id.getbodhi.app')
  userRole?: string; // OAuth scope (default: 'scope_user_user')
  basePath?: string; // Backend URL (default: 'http://localhost:1135')
  logLevel?: LogLevel; // Logging (default: LogLevel.Info)
  initParams?: {
    extension?: {
      timeoutMs?: number; // ext2ext timeout (default: 5000)
      attempts?: number; // Connection retry attempts (default: 3)
      attemptWaitMs?: number; // Wait between retries (default: 1000)
      attemptTimeout?: number; // Timeout per attempt (default: 3000)
    };
  };
}
```

### Common Use Cases

#### Custom Retry Configuration

```typescript
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('my-extension', {
  initParams: {
    extension: {
      attempts: 5, // Retry 5 times
      attemptWaitMs: 2000, // Wait 2s between attempts
      attemptTimeout: 5000, // 5s timeout per attempt
    },
  },
});
```

---

## Client Override in Preset Providers

Even when using preset packages, you can override auto-client creation by passing a `client` prop:

### Web Preset Override

```typescript
import { BodhiProvider, WebUIClient } from '@bodhiapp/bodhi-js-react';

const customClient = new WebUIClient('my-app', {
  redirectUri: 'https://custom.example.com/callback',
});

<BodhiProvider client={customClient}>
  <App />
</BodhiProvider>;
```

### Extension Preset Override

```typescript
import { BodhiProvider, ExtUIClient } from '@bodhiapp/bodhi-js-react-ext';

const customClient = new ExtUIClient('my-extension', {
  logLevel: 'debug', // Custom logging for testing
});

<BodhiProvider client={customClient}>
  <ExtensionUI />
</BodhiProvider>;
```

**When to use this pattern**:

- You like the preset imports (single package)
- But need custom client configuration
- Combines convenience of presets with flexibility of DI

---

## Testing with Dependency Injection

### Mock Client for Unit Tests

```typescript
import { render } from '@testing-library/react';
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import type { UIClient } from '@bodhiapp/bodhi-js-core';

// Create mock client
const mockClient: UIClient = {
  state: {
    /* mock state */
  },
  onStateChange: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
  chat: vi.fn().mockResolvedValue({
    /* mock response */
  }),
  // ... other methods
};

// Use in tests
function renderWithBodhi(component) {
  return render(<BodhiProvider client={mockClient}>{component}</BodhiProvider>);
}
```

### Integration Tests with Real Client

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import { WebUIClient } from '@bodhiapp/bodhi-js';

// Test with real client against test backend
const testClient = new WebUIClient('test-app', {
  basePath: 'http://localhost:9999', // Test server
  logLevel: 'debug', // Verbose logging for debugging
});

render(
  <BodhiProvider client={testClient}>
    <IntegrationTestComponent />
  </BodhiProvider>
);
```

---

## Client Lifecycle Management

### Singleton Pattern (Recommended)

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

// Create once, reuse everywhere
let clientInstance: WebUIClient | null = null;

export function getBodhiClient() {
  if (!clientInstance) {
    clientInstance = new WebUIClient('my-app', {
      // config
    });
  }
  return clientInstance;
}

// Usage in App
function App() {
  const client = getBodhiClient();

  return (
    <BodhiProvider client={client}>
      <MyComponents />
    </BodhiProvider>
  );
}
```

### Dynamic Client Creation

```typescript
import { useState, useMemo } from 'react';
import { WebUIClient } from '@bodhiapp/bodhi-js';
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';

function TenantApp({ tenantId }: { tenantId: string }) {
  // Create new client when tenantId changes
  const client = useMemo(
    () =>
      new WebUIClient('my-app', {
        basePath: `/tenant/${tenantId}`, // Multi-tenant storage isolation
      }),
    [tenantId]
  );

  return (
    <BodhiProvider client={client}>
      <TenantUI />
    </BodhiProvider>
  );
}
```

---

## Advanced OAuth Configuration

### Custom User Scope

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('my-app', {
  userRole: 'scope_user_power_user', // Request power user privileges
});
```

### Enterprise OAuth Server

```typescript
import { ExtUIClient } from '@bodhiapp/bodhi-js-ext';

const client = new ExtUIClient('corp-extension', {
  authServerUrl: 'https://auth.corp.internal',
  redirectUri: 'https://corp.example.com/oauth/callback',
});
```

---

## Best Practices

1. **Default to Presets**: Use `@bodhiapp/bodhi-js-react` or `@bodhiapp/bodhi-js-react-ext` unless you have specific needs listed at the top of this guide.

2. **Singleton Clients**: Create client instances once and reuse them. Avoid creating new clients on every render.

3. **Multi-Tenant Storage**: Use `basePath` for multi-tenant isolation or path-based deployments (e.g., GitHub Pages). See [Multi-Tenant Patterns](./multi-tenant.md).

4. **Type Safety**: Import types from `@bodhiapp/bodhi-js-core` for strict typing:

   ```typescript
   import type { UIClient, WebUIClientParams } from '@bodhiapp/bodhi-js';
   ```

5. **Environment-Specific Config**: Use environment variables for different configurations:
   ```typescript
   const client = new WebUIClient('my-app', {
     basePath: process.env.VITE_BODHI_BACKEND_URL,
     logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Info,
   });
   ```

---

## Summary

| Use Case             | Package                                                      | Pattern                                    |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| Simple web app       | `@bodhiapp/bodhi-js-react`                                   | Preset with `authClientId`                 |
| Simple extension     | `@bodhiapp/bodhi-js-react-ext`                               | Preset with `authClientId`                 |
| Custom web config    | `@bodhiapp/bodhi-js-react-core` + `@bodhiapp/bodhi-js`       | DI with `client` prop                      |
| Custom ext config    | `@bodhiapp/bodhi-js-react-core` + `@bodhiapp/bodhi-js-ext`   | DI with `client` prop                      |
| Preset with override | `@bodhiapp/bodhi-js-react` or `@bodhiapp/bodhi-js-react-ext` | Pass `client` prop to preset BodhiProvider |

---

← Back to [React Integration](../react-integration.md) | Continue to [Multi-Tenant Patterns](./multi-tenant.md) →
