# Error Factories

Create type-safe error objects for custom error handling in advanced scenarios.

> **Note**: Most applications don't need to create custom errors - the SDK handles errors automatically. This guide is for advanced use cases like custom SDK wrappers or error transformation.

## Overview

The SDK provides two error factory functions for creating structured error objects compatible with the SDK's error handling system.

## createApiError

Create HTTP API errors with structured response information:

```typescript
import { createApiError } from '@bodhiapp/bodhi-js-core';

// Create 404 error
const error = createApiError(
  'Resource not found',
  404,
  {
    error: {
      message: 'Model "invalid-model" not found',
      type: 'invalid_request_error',
      code: 'model_not_found',
      param: 'model',
    },
  },
  {
    'content-type': 'application/json',
    'x-request-id': 'req_123',
  }
);

throw error;
```

### Signature

```typescript
function createApiError(message: string, status: number, body: OpenAiApiError, headers?: Record<string, string>): ApiError;

interface ApiError extends Error {
  response: {
    status: number;
    body: OpenAiApiError;
    headers?: Record<string, string>;
  };
}

interface OpenAiApiError {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}
```

### Usage Example

```typescript
// Custom API wrapper
async function customApiCall(endpoint: string) {
  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      const body = await response.json();
      throw createApiError(`HTTP ${response.status}`, response.status, body, Object.fromEntries(response.headers.entries()));
    }

    return await response.json();
  } catch (err) {
    if (err instanceof Error && 'response' in err) {
      // It's an ApiError
      console.error('API Error:', err.response.status);
    }
    throw err;
  }
}
```

## createOperationError

Create operation-level errors (network, extension, etc.) for scenarios without HTTP responses:

```typescript
import { createOperationError } from '@bodhiapp/bodhi-js-core';

// Create extension error
const error = createOperationError('Extension not detected', 'extension_error');

throw error;
```

### Signature

```typescript
function createOperationError(message: string, type: string): OperationError;

interface OperationError extends Error {
  error: {
    message: string;
    type: string;
  };
}
```

### Common Error Types

| Type              | Use Case                          |
| ----------------- | --------------------------------- |
| `extension_error` | Extension not available or failed |
| `network_error`   | Network connection failed         |
| `timeout_error`   | Request timed out                 |
| `auth_error`      | Authentication failed             |

### Usage Example

```typescript
// Custom extension check
async function checkExtension(): Promise<string> {
  const isAvailable = await detectExtension();

  if (!isAvailable) {
    throw createOperationError('Bodhi Browser extension not installed', 'extension_error');
  }

  return extensionId;
}
```

## Using Error Type Guards

```typescript
import { isOperationError } from '@bodhiapp/bodhi-js-react';

try {
  await client.sendApiRequest('GET', '/v1/models');
} catch (err) {
  if (isOperationError(err)) {
    console.error('Operation error:', err.error.message);
    console.error('Error type:', err.error.type);

    // Handle specific operation errors
    switch (err.error.type) {
      case 'extension_error':
        showExtensionInstallPrompt();
        break;
      case 'network_error':
        showNetworkErrorMessage();
        break;
      case 'timeout_error':
        showRetryPrompt();
        break;
    }
  } else if (err instanceof Error && 'response' in err) {
    // ApiError
    const apiErr = err as { response: { status: number; body: any } };
    console.error(`HTTP ${apiErr.response.status}:`, apiErr.response.body);
  } else if (err instanceof Error) {
    console.error('Unknown error:', err.message);
  }
}
```

## Best Practices

### 1. Use for Custom Wrappers Only

```typescript
// ✅ DO use when wrapping SDK with custom logic
class CustomBodhiClient {
  async customMethod() {
    try {
      // Custom logic
    } catch (err) {
      throw createOperationError('Custom operation failed', 'custom_error');
    }
  }
}

// ❌ DON'T create errors for normal SDK usage
const result = await client.sendApiRequest(...);
// SDK already handles errors - no need to create custom ones
```

### 2. Match SDK Error Structure

```typescript
// ✅ DO use SDK-compatible error structure
throw createApiError('Not Found', 404, {
  error: {
    message: 'Resource not found',
    type: 'invalid_request_error',
    code: 'not_found',
  },
});

// ❌ DON'T throw plain errors when SDK expects ApiError
throw new Error('Not found'); // Won't work with isApiResultError()
```

### 3. Use Appropriate Error Type

```typescript
// ✅ DO use ApiError for HTTP errors
if (response.status >= 400) {
  throw createApiError('HTTP error', response.status, body);
}

// ✅ DO use OperationError for non-HTTP errors
if (!extensionAvailable) {
  throw createOperationError('Extension unavailable', 'extension_error');
}
```

## Error Transformation Example

```typescript
// Transform third-party errors to SDK format
async function transformedApiCall(url: string) {
  try {
    const response = await thirdPartyClient.get(url);
    return response.data;
  } catch (err: any) {
    // Transform to SDK-compatible error
    if (err.response) {
      // HTTP error - create ApiError
      throw createApiError(err.message, err.response.status, {
        error: {
          message: err.response.data.message || err.message,
          type: 'api_error',
          code: err.response.data.code,
        },
      });
    } else if (err.code === 'ECONNREFUSED') {
      // Network error - create OperationError
      throw createOperationError('Cannot connect to server', 'network_error');
    } else {
      // Unknown error - create OperationError
      throw createOperationError(err.message || 'Unknown error', 'unknown_error');
    }
  }
}
```

## When NOT to Use

- Normal SDK operations (SDK handles errors)
- User-facing error messages (use error handling patterns instead)
- Non-error scenarios (use regular return values)

## Related Documentation

- **[Error Handling](../error-handling.md)** - Complete error handling guide
- **[API Reference](../api-reference.md#error-factories)** - Error factory API reference

---

← Back to [Overview](../index.md)
