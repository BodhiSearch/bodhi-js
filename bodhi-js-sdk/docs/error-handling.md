# Error Handling

Comprehensive guide to handling errors in the Bodhi JS SDK using class-based patterns.

## Overview

The SDK uses two error classes for all failure scenarios:

- **BodhiApiError**: HTTP errors (4xx/5xx) from the server
- **BodhiError**: Operational errors (network, timeout, extension, auth)

Both classes extend `Error` and are discriminated using `instanceof`.

## Error Classes

### BodhiError

Base class for operational errors — network failures, timeouts, extension unavailability, and authentication problems:

```typescript
class BodhiError extends Error {
  readonly code: BodhiErrorCode; // 'network' | 'timeout' | 'extension' | 'auth'
}
```

**Example**:

```typescript
{
  message: 'Extension not detected',
  code: 'extension'
}
```

### BodhiApiError

HTTP errors with response details, thrown when the server returns 4xx or 5xx:

```typescript
class BodhiApiError extends BodhiError {
  readonly status: number; // HTTP status code
  readonly body: OpenAiApiError; // OpenAI-format error body
  readonly headers?: Record<string, string>; // Response headers
}

interface OpenAiApiError {
  error: {
    message: string; // Error message
    type: string; // Error type
    code?: string; // Error code
    param?: string; // Parameter that caused error
  };
}
```

**Example**:

```typescript
{
  message: 'Request failed with status 404',
  code: 'network',
  status: 404,
  body: {
    error: {
      message: 'Model not found',
      type: 'invalid_request_error',
      code: 'model_not_found',
      param: 'model'
    }
  }
}
```

## ApiResponse and unwrapResponse

`sendApiRequest` returns `ApiResponse<T>`, which wraps the HTTP response without throwing on 4xx/5xx:

```typescript
interface ApiResponse<T> {
  body: T;
  status: number;
  headers?: Record<string, string>;
}
```

Use `unwrapResponse` to extract the body or throw `BodhiApiError` on HTTP errors:

```typescript
function unwrapResponse<T>(response: ApiResponse<T>): T; // throws BodhiApiError on status >= 400
```

## Complete Error Handling Pattern

### Recommended Approach

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

async function fetchModels() {
  try {
    const response = await client.sendApiRequest('GET', '/v1/models');
    const body = unwrapResponse(response); // throws BodhiApiError on 4xx/5xx
    return body.data;
  } catch (err) {
    if (err instanceof BodhiApiError) {
      console.error(`HTTP ${err.status}: ${err.message}`, err.body);
    } else if (err instanceof BodhiError) {
      console.error(`Operational error [${err.code}]: ${err.message}`);
    } else {
      throw err;
    }
  }
}
```

## Error Handling by Scenario

### Extension Not Detected

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

try {
  const response = await client.sendApiRequest('GET', '/v1/models');
  const body = unwrapResponse(response);
  return body.data;
} catch (err) {
  if (err instanceof BodhiError && err.code === 'extension') {
    // Show extension installation prompt
    setError('Extension not installed');
    setShowExtensionPrompt(true);
  }
}
```

### Network Errors

```typescript
try {
  const response = await client.sendApiRequest('GET', '/v1/models');
  const body = unwrapResponse(response);
  return body.data;
} catch (err) {
  if (err instanceof BodhiError && err.code === 'network') {
    // Server not reachable
    setError('Cannot connect to local server');
    setShowServerSetup(true);
  }
}
```

### Authentication Errors

```typescript
try {
  const response = await client.sendApiRequest('GET', '/v1/protected');
  const body = unwrapResponse(response);
  return body;
} catch (err) {
  if (err instanceof BodhiApiError && err.status === 401) {
    console.log('Authentication required');
    await login();
  }
}
```

### Model Not Found

```typescript
try {
  const response = await client.sendApiRequest('GET', '/v1/models/unknown');
  const body = unwrapResponse(response);
  return body;
} catch (err) {
  if (err instanceof BodhiApiError && err.status === 404 && err.body.error.code === 'model_not_found') {
    setError(`Model "${err.body.error.param}" not found`);
  }
}
```

### Rate Limiting

```typescript
try {
  const response = await client.sendApiRequest('POST', '/v1/chat/completions', request);
  const body = unwrapResponse(response);
  return body;
} catch (err) {
  if (err instanceof BodhiApiError && err.status === 429) {
    const retryAfter = err.headers?.['retry-after'];
    setError(`Rate limited. Retry after ${retryAfter} seconds`);
  }
}
```

## React Error Handling Patterns

### Error State Management

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

function ApiComponent() {
  const { client } = useBodhi();
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.sendApiRequest('GET', '/v1/models');
      const body = unwrapResponse(response);
      setData(body);
    } catch (err) {
      if (err instanceof BodhiApiError) {
        setError(`HTTP ${err.status}: ${err.body.error.message}`);
      } else if (err instanceof BodhiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <Spinner />}
      {data && <DataDisplay data={data} />}
      <button onClick={fetchData}>Fetch</button>
    </div>
  );
}
```

### Error Boundary

```typescript
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <BodhiProvider authClientId="your-client-id">
    <App />
  </BodhiProvider>
</ErrorBoundary>
```

## Streaming Error Handling

### Basic Streaming Errors

```typescript
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

try {
  for await (const chunk of client.chat.completions.create({
    model: 'gemma-3n-e4b-it',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  })) {
    console.log(chunk.choices?.[0]?.delta?.content);
  }
} catch (err) {
  if (err instanceof BodhiApiError) {
    setError(`HTTP ${err.status}: ${err.body.error.message}`);
  } else if (err instanceof BodhiError) {
    setError(`Connection error [${err.code}]: ${err.message}`);
  } else {
    setError('Unknown error occurred');
  }
}
```

### Retry Failed Streams

```typescript
async function* streamWithRetry(model: string, prompt: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      for await (const chunk of client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      })) {
        yield chunk;
      }
      return; // Success
    } catch (err) {
      if (attempt === maxRetries) {
        throw err; // Give up
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Advanced: Custom Error Creation

For creating custom error objects in advanced scenarios, see [Error Factories](./advanced/core-utilities.md#error-factories) in the Advanced Core Utilities guide.

## Common Error Codes

### BodhiError Codes

| Code        | Cause                     | Solution                         |
| ----------- | ------------------------- | -------------------------------- |
| `extension` | Extension not available   | Install extension                |
| `network`   | Network connection failed | Check server running             |
| `timeout`   | Request timed out         | Increase timeout or check server |
| `auth`      | Authentication failed     | Re-login                         |

### HTTP Error Status Codes

| Status | Type                    | Cause                 | Solution                    |
| ------ | ----------------------- | --------------------- | --------------------------- |
| 400    | `invalid_request_error` | Bad request           | Check request parameters    |
| 401    | `invalid_request_error` | Unauthorized          | Login required              |
| 403    | `permission_error`      | Forbidden             | Check permissions           |
| 404    | `invalid_request_error` | Not found             | Check endpoint/model exists |
| 429    | `rate_limit_error`      | Too many requests     | Wait and retry              |
| 500    | `server_error`          | Internal server error | Check server logs           |
| 503    | `service_unavailable`   | Service unavailable   | Server overloaded           |

## User-Friendly Error Messages

### Map Technical Errors to User Messages

```typescript
import { BodhiError, BodhiApiError } from '@bodhiapp/bodhi-js-react';

function getUserFriendlyError(err: unknown): string {
  if (err instanceof BodhiApiError) {
    switch (err.status) {
      case 401:
        return 'Please login to continue.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return `Server error (${err.status}). Please try again.`;
    }
  }

  if (err instanceof BodhiError) {
    switch (err.code) {
      case 'extension':
        return 'Browser extension not installed. Please install the Bodhi Browser extension.';
      case 'network':
        return 'Cannot connect to local AI server. Please ensure it is running.';
      case 'timeout':
        return 'Request took too long. Please try again.';
      default:
        return 'Connection error. Please check your setup.';
    }
  }

  return 'An unexpected error occurred.';
}
```

### Error Display Component

```typescript
import { BodhiError } from '@bodhiapp/bodhi-js-react';

interface ErrorMessageProps {
  err: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function ErrorMessage({ err, onRetry, onDismiss }: ErrorMessageProps) {
  const message = getUserFriendlyError(err);
  const severity = err instanceof BodhiError && err.code === 'extension' ? 'warning' : 'error';

  return (
    <Alert severity={severity} onClose={onDismiss}>
      <strong>Error:</strong> {message}
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </Alert>
  );
}
```

## Best Practices

### 1. Use instanceof for Discrimination

```typescript
// ❌ DON'T check properties directly
if ('code' in err) {
  // Unsafe — could be any error
}

// ✅ DO use instanceof
if (err instanceof BodhiApiError) {
  // TypeScript knows err.status, err.body, err.headers exist
} else if (err instanceof BodhiError) {
  // TypeScript knows err.code exists
}
```

### 2. Check BodhiApiError Before BodhiError

```typescript
// ✅ Check BodhiApiError first (it extends BodhiError)
if (err instanceof BodhiApiError) {
  // Has HTTP response: err.status, err.body
} else if (err instanceof BodhiError) {
  // Operational error: err.code
} else {
  throw err; // Re-throw unexpected errors
}
```

### 3. Provide Actionable Error Messages

```typescript
// ❌ DON'T show technical errors
setError('ERR_CONNECTION_REFUSED');

// ✅ DO provide actionable guidance
setError('Cannot connect to local server. Please ensure it is running on port 1135.');
```

### 4. Log Errors for Debugging

```typescript
if (err instanceof BodhiApiError) {
  console.error('API Error:', {
    status: err.status,
    error: err.body.error,
    headers: err.headers,
  });
  setUserError(getUserFriendlyError(err));
}
```

### 5. Handle Errors Gracefully

```typescript
// ✅ Provide fallback UI
function ModelList() {
  const [models, setModels] = useState([]);
  const [error, setError] = useState(null);

  if (error) {
    return (
      <EmptyState
        title="Unable to Load Models"
        message={error}
        action={<Button onClick={retry}>Retry</Button>}
      />
    );
  }

  return <List items={models} />;
}
```

## Streaming vs Non-Streaming Error Handling

Both streaming and non-streaming methods throw `BodhiError` and `BodhiApiError` directly.

### Non-Streaming API Requests

`sendApiRequest` throws `BodhiError` on operational failures. Use `unwrapResponse` to throw `BodhiApiError` on HTTP errors:

```typescript
import { BodhiError, BodhiApiError, unwrapResponse } from '@bodhiapp/bodhi-js-react';

try {
  const response = await client.sendApiRequest('GET', '/v1/models');
  const body = unwrapResponse(response); // throws BodhiApiError on 4xx/5xx
  console.log(body);
} catch (err) {
  if (err instanceof BodhiApiError) {
    console.error(`HTTP ${err.status}:`, err.body.error.message);
  } else if (err instanceof BodhiError) {
    console.error(`Operational error [${err.code}]:`, err.message);
  }
}
```

### Streaming Requests

Streaming methods (`stream()`, `client.chat.completions.create({ stream: true })`) throw `BodhiError` or `BodhiApiError` directly from iteration:

```typescript
try {
  for await (const chunk of client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  })) {
    // Process...
  }
} catch (err) {
  if (err instanceof BodhiApiError) {
    // HTTP error during SSE (e.g. model not found)
    console.error('HTTP error:', err.status, err.body.error.message);
  } else if (err instanceof BodhiError) {
    // Connection error
    console.error('Connection error:', err.code, err.message);
  }
}
```

See [Streaming](./streaming.md) for more details on streaming error patterns.

## Next Steps

- **[Extension SDK](./extension-sdk.md)** - Extension-specific error patterns
- **[API Reference](./api-reference.md)** - Complete error type reference

---

← Back to [Client State](./client-state.md) | Continue to [Extension SDK](./extension-sdk.md) →
