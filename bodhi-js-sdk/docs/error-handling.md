# Error Handling

Comprehensive guide to handling errors in the Bodhi JS SDK using type-safe patterns.

## Overview

The SDK provides two types of errors:

- **ApiError**: HTTP errors (4xx/5xx) from the server
- **OperationError**: Network/extension level errors

Both types are integrated into the `ApiResponseResult` type for type-safe error handling.

## Error Types

### ApiError

HTTP errors with response details:

```typescript
interface ApiError extends Error {
  response: {
    status: number; // HTTP status code
    body: OpenAiApiError; // OpenAI-format error body
    headers?: Record<string, string>; // Response headers
  };
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
  response: {
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
}
```

### OperationError

Network/extension errors without HTTP response:

```typescript
interface OperationError extends Error {
  error: {
    message: string; // Error message
    type: string; // Error type
  };
}
```

**Example**:

```typescript
{
  message: 'Extension not detected',
  error: {
    message: 'Extension not detected',
    type: 'extension_error'
  }
}
```

## ApiResponseResult Type

All API requests return `ApiResponseResult<T>`:

```typescript
type ApiResponseResult<T> =
  | ApiResponse<T> // Success
  | { error: OperationErrorResponse }; // Operation error

interface ApiResponse<T> {
  body: T;
  status: number;
  headers?: Record<string, string>;
}

interface OperationErrorResponse {
  message: string;
  type: string;
}
```

## Type Guards

Use type guards to handle responses safely:

### isApiResultSuccess

Check for successful response (HTTP 2xx):

```typescript
import { isApiResultSuccess } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultSuccess(result)) {
  // result.body is typed correctly
  console.log(result.body);
}
```

### isApiResultError

Check for HTTP error (4xx/5xx):

```typescript
import { isApiResultError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultError(result)) {
  // HTTP error with response
  console.error(`HTTP ${result.status}:`, result.body.error.message);
}
```

### isApiResultOperationError

Check for operation/network error:

```typescript
import { isApiResultOperationError } from '@bodhiapp/bodhi-js-react';

const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultOperationError(result)) {
  // Network/extension error
  console.error('Operation error:', result.error.message);
}
```

## Complete Error Handling Pattern

### Recommended Approach

```typescript
import { isApiResultOperationError, isApiResultError, isApiResultSuccess } from '@bodhiapp/bodhi-js-react';

async function fetchModels() {
  const result = await client.sendApiRequest('GET', '/v1/models');

  // 1. Check for operation errors first (no HTTP response)
  if (isApiResultOperationError(result)) {
    console.error('Connection error:', result.error.message);
    switch (result.error.type) {
      case 'extension_error':
        return 'Extension not available';
      case 'network_error':
        return 'Network connection failed';
      case 'timeout_error':
        return 'Request timed out';
      default:
        return `Error: ${result.error.message}`;
    }
  }

  // 2. Check HTTP status
  if (isApiResultError(result)) {
    console.error(`HTTP ${result.status}:`, result.body.error);
    return `Server error: ${result.body.error.message}`;
  }

  // 3. Success
  if (isApiResultSuccess(result)) {
    return result.body.data;
  }

  // TypeScript ensures all cases handled
}
```

## Error Handling by Scenario

### Extension Not Detected

```typescript
const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultOperationError(result)) {
  if (result.error.type === 'extension_error') {
    // Show extension installation prompt
    setError('Extension not installed');
    setShowExtensionPrompt(true);
  }
}
```

### Network Errors

```typescript
if (isApiResultOperationError(result)) {
  if (result.error.type === 'network_error') {
    // Server not reachable
    setError('Cannot connect to local server');
    setShowServerSetup(true);
  }
}
```

### Authentication Errors

```typescript
if (isApiResultError(result)) {
  if (result.status === 401) {
    // Unauthorized
    console.log('Authentication required');
    await login();
  }
}
```

### Model Not Found

```typescript
if (isApiResultError(result)) {
  if (result.status === 404 && result.body.error.code === 'model_not_found') {
    setError(`Model "${result.body.error.param}" not found`);
  }
}
```

### Rate Limiting

```typescript
if (isApiResultError(result)) {
  if (result.status === 429) {
    const retryAfter = result.headers?.['retry-after'];
    setError(`Rate limited. Retry after ${retryAfter} seconds`);
  }
}
```

## React Error Handling Patterns

### Error State Management

```typescript
function ApiComponent() {
  const { client } = useBodhi();
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await client.sendApiRequest('GET', '/v1/models');

      if (isApiResultOperationError(result)) {
        setError(result.error.message);
        return;
      }

      if (isApiResultError(result)) {
        setError(`HTTP ${result.status}: ${result.body.error.message}`);
        return;
      }

      if (isApiResultSuccess(result)) {
        setData(result.body);
      }
    } catch (err) {
      // Unexpected error
      setError(err instanceof Error ? err.message : 'Unknown error');
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
  <BodhiProvider client={client}>
    <App />
  </BodhiProvider>
</ErrorBoundary>
```

## Streaming Error Handling

### Basic Streaming Errors

```typescript
try {
  const stream = client.chat.completions.create({
    model: 'gemma-3n-e4b-it',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    console.log(chunk.choices?.[0]?.delta?.content);
  }
} catch (err) {
  if (err instanceof Error) {
    // HTTP errors: "HTTP 404: ..." format
    // Network errors: "Network error: ..." format
    setError(`Stream error: ${err.message}`);
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
      const stream = client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
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

### Operation Error Types

| Type              | Cause                     | Solution                         |
| ----------------- | ------------------------- | -------------------------------- |
| `extension_error` | Extension not available   | Install extension                |
| `network_error`   | Network connection failed | Check server running             |
| `timeout_error`   | Request timed out         | Increase timeout or check server |
| `auth_error`      | Authentication failed     | Re-login                         |

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
function getUserFriendlyError(result: ApiResponseResult<unknown>): string {
  if (isApiResultOperationError(result)) {
    switch (result.error.type) {
      case 'extension_error':
        return 'Browser extension not installed. Please install the Bodhi Browser extension.';
      case 'network_error':
        return 'Cannot connect to local AI server. Please ensure it is running.';
      case 'timeout_error':
        return 'Request took too long. Please try again.';
      default:
        return 'Connection error. Please check your setup.';
    }
  }

  if (isApiResultError(result)) {
    switch (result.status) {
      case 401:
        return 'Please login to continue.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return `Server error (${result.status}). Please try again.`;
    }
  }

  return 'An unexpected error occurred.';
}
```

### Error Display Component

```typescript
interface ErrorMessageProps {
  result: ApiResponseResult<unknown>;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function ErrorMessage({ result, onRetry, onDismiss }: ErrorMessageProps) {
  const message = getUserFriendlyError(result);

  // Determine severity
  let severity: 'error' | 'warning' = 'error';
  if (isApiResultOperationError(result)) {
    severity = result.error.type === 'extension_error' ? 'warning' : 'error';
  }

  return (
    <Alert severity={severity} onClose={onDismiss}>
      <strong>Error:</strong> {message}
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </Alert>
  );
}
```

## Best Practices

### 1. Always Use Type Guards

```typescript
// ❌ DON'T check properties directly
if ('error' in result) {
  // Unsafe - could be ApiError or OperationError
}

// ✅ DO use type guards
if (isApiResultOperationError(result)) {
  // TypeScript knows result.error exists
}
```

### 2. Check Operation Errors First

```typescript
// ✅ Check operation errors before HTTP errors
if (isApiResultOperationError(result)) {
  // No HTTP response
} else if (isApiResultError(result)) {
  // Has HTTP response
} else if (isApiResultSuccess(result)) {
  // Success
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
if (isApiResultError(result)) {
  console.error('API Error:', {
    status: result.status,
    error: result.body.error,
    headers: result.headers,
  });
  setUserError(getUserFriendlyError(result));
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

**Important**: Streaming methods have different error patterns than non-streaming API requests.

### Non-Streaming API Requests

Non-streaming methods return `ApiResponseResult<T>`:

```typescript
// Returns ApiResponseResult<T>
const result = await client.sendApiRequest('GET', '/v1/models');

if (isApiResultOperationError(result)) {
  // Network/extension error
  console.error(result.error.message);
} else if (isApiResultError(result)) {
  // HTTP error
  console.error(`HTTP ${result.status}:`, result.body.error.message);
} else if (isApiResultSuccess(result)) {
  // Success
  console.log(result.body);
}
```

### Streaming Requests

Streaming methods (`stream()`, `client.chat.completions.create({ stream: true })`) throw `Error` objects directly:

```typescript
// Throws Error objects
try {
  const stream = client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });
  for await (const chunk of stream) {
    // Process...
  }
} catch (err) {
  if (err instanceof Error) {
    // HTTP errors: "HTTP 404: ..." format
    // Network errors: "Network error: ..." format
    console.error('Stream error:', err.message);
  }
}
```

**Real-World Example** (from sdk-test-app):

```typescript
// ChatSection.tsx pattern
try {
  const stream = client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });
  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content || '';
    setResponse(prev => prev + content);
  }
} catch (err) {
  // Streaming throws Error, not ApiResponseResult
  if (err instanceof Error) {
    setError(`Stream error: ${err.message}`);
  } else {
    setError('Unknown error occurred');
  }
}
```

See [Streaming](./streaming.md) for more details on streaming error patterns.

## Next Steps

- **[Extension SDK](./extension-sdk.md)** - Extension-specific error patterns
- **[API Reference](./api-reference.md)** - Complete error type reference

---

← Back to [Client State](./client-state.md) | Continue to [Extension SDK](./extension-sdk.md) →
