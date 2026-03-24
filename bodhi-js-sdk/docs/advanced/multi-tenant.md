# Multi-Tenant Patterns

Advanced patterns for running multiple BodhiProvider instances in multi-tenant applications.

> **Note**: Most applications only need a single BodhiProvider instance with the preset packages (`@bodhiapp/bodhi-js-react` or `@bodhiapp/bodhi-js-react-ext`). This guide is for multi-tenant SaaS applications where different users/tenants need isolated SDK instances with custom configuration.

## Overview

Multi-tenant applications use dependency injection with `@bodhiapp/bodhi-js-react-core` to create multiple client instances with different `basePath` values, each maintaining separate:

- Connection state
- Authentication tokens
- User preferences
- Storage namespaces

### Server-Side Multi-Tenant Awareness

Multi-tenant Bodhi servers return `'ready'` for unauthenticated `/bodhi/v1/info` calls. Tenant selection is handled through the server's dashboard when accessed with authentication.

Key `BackendServerState` fields for multi-tenant:

- **`deployment`**: `'standalone'` or `'multi_tenant'` indicating the server's deployment mode
- **`client_id`**: The active tenant's OAuth client_id (present once a tenant is selected)

For full details on dependency injection, see [Client Injection](./client-injection.md).

## Multiple Provider Instances

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';
import { Router, Route } from 'react-router-dom';

function MultiTenantApp() {
  const tenant1Client = new WebUIClient('tenant1-id', {
    basePath: '/tenant1',
  });

  const tenant2Client = new WebUIClient('tenant2-id', {
    basePath: '/tenant2',
  });

  return (
    <Router>
      <Route path="/tenant1/*">
        <BodhiProvider
          client={tenant1Client}
          basePath="/tenant1"  // callbackPath auto-computed
        >
          <Tenant1App />
        </BodhiProvider>
      </Route>

      <Route path="/tenant2/*">
        <BodhiProvider
          client={tenant2Client}
          basePath="/tenant2"
        >
          <Tenant2App />
        </BodhiProvider>
      </Route>
    </Router>
  );
}
```

**Why use `@bodhiapp/bodhi-js-react-core`**: Multi-tenant apps need manual client creation for per-tenant configuration. The preset packages auto-create clients, which doesn't work for this use case.

## Storage Isolation

Each client instance uses a separate storage namespace via `basePath`:

```typescript
const tenant1Client = new WebUIClient('tenant1-id', {
  basePath: '/tenant1',
});

const tenant2Client = new WebUIClient('tenant2-id', {
  basePath: '/tenant2',
});

// basePath automatically namespaces storage keys using the pattern:
//   {basePath}:{facade-prefix}:{client-type}:{key}
//
// localStorage: /tenant1:bodhi-js-sdk:web:CONNECTION_MODE
// localStorage: /tenant1:bodhi-js-sdk:web:EXTENSION_ID
// localStorage: /tenant2:bodhi-js-sdk:web:CONNECTION_MODE
// localStorage: /tenant2:bodhi-js-sdk:web:EXTENSION_ID
```

## OAuth Configuration

Each tenant needs separate OAuth client registration:

```typescript
// Register at https://developer.getbodhi.app
// Create separate client IDs for each tenant

const tenant1Client = new WebUIClient('tenant1-client-id', {
  basePath: '/tenant1',
});

const tenant2Client = new WebUIClient('tenant2-client-id', {
  basePath: '/tenant2',
});
```

## Shared vs Isolated State

**Shared** (across all tenants):

- Browser extension availability
- Extension ID (same bodhi-browser-ext installation)
- Server URL (same local backend instance)

**Isolated** (per tenant):

- Authentication tokens
- User profile
- Connection mode preference
- Setup modal state

## Best Practices

### 1. Use basePath for Isolation

```typescript
// ✅ DO use tenant-specific basePath
const client = new WebUIClient(clientId, {
  basePath: `/tenant/${tenantId}`,
});

// ❌ DON'T share basePath across tenants
const client = new WebUIClient(clientId); // All use default '/' basePath
```

### 2. Separate OAuth Clients

```typescript
// ✅ DO register separate OAuth clients per tenant
// This enables per-tenant access control and monitoring
```

### 3. Route Isolation

```typescript
// ✅ DO use distinct routes
<Route path="/tenant/:id/*">
  <TenantRouter />
</Route>

// Each tenant gets isolated routing context
```

## Dynamic Tenant Routing

```typescript
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { WebUIClient } from '@bodhiapp/bodhi-js';
import { BodhiProvider } from '@bodhiapp/bodhi-js-react-core';

function TenantRouter() {
  const { id } = useParams<{ id: string }>();

  const client = useMemo(() => {
    return new WebUIClient(`tenant-${id}-client-id`, {
      basePath: `/tenant/${id}`,
    });
  }, [id]);

  return (
    <BodhiProvider
      client={client}
      basePath={`/tenant/${id}`}  // callbackPath auto-computed
    >
      <TenantApp tenantId={id} />
    </BodhiProvider>
  );
}
```

## Limitations

- Extension mode: Extension is shared, cannot have tenant-specific extensions
- Server connection: All tenants connect to same local backend (per user machine)
- Modal state: Setup modal is global (last opened tenant controls modal)

## When to Use

Use multi-tenant patterns when:

- Building SaaS with multiple organizations
- Each tenant needs separate auth/billing
- Isolated user data per tenant

Don't use if:

- Single organization with multiple users
- Shared authentication across all users
- Simple multi-user application

---

← Back to [React Integration](../react-integration.md)
