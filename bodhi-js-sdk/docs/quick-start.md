# Quick Start

Get started with Bodhi JS SDK in 5 minutes. This guide walks you through creating a minimal React chat application using the simplified preset package.

## Prerequisites

Before starting, ensure you have:

- Node.js 18+ installed
- A React project set up (or create one with `npm create vite@latest`)
- Bodhi App backend running (download from [getbodhi.app](https://getbodhi.app))
- Bodhi Browser extension installed (optional - for extension connection mode)

## Step 1: Install Package

Install the React preset - everything you need in one package:

```bash
npm install @bodhiapp/bodhi-js-react
```

That's it! No need to install multiple packages.

> **Coming from OpenAI?** The API will feel familiar - we mirror the OpenAI SDK patterns like `chat.completions.create()` and `models.list()` for a smooth developer experience.

## Step 2: Wrap Your App with BodhiProvider

Update `src/App.tsx`:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';
import Chat from './Chat';

// OAuth client ID (register at https://developer.getbodhi.app)
const CLIENT_ID = 'app-dummy-uuid-4a6d-8f4b-0a3e7c9b2d1e';

function App() {
  return (
    <BodhiProvider authClientId={CLIENT_ID}>
      <div className="app">
        <h1>My Bodhi Chat App</h1>
        <Chat />
      </div>
    </BodhiProvider>
  );
}

export default App;
```

**That's all the setup needed!** Just pass your `authClientId` - the SDK handles everything else.

**Optional Configuration**:

If you need custom configuration, pass a `clientConfig` object:

```typescript
<BodhiProvider
  authClientId={CLIENT_ID}
  clientConfig={{
    redirectUri: 'https://myapp.com/callback',
    logLevel: 'debug',
  }}
>
  <App />
</BodhiProvider>
```

See [Client Injection](./advanced/client-injection.md) for advanced configuration options.

## Step 3: Create a Chat Component

Create `src/Chat.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function Chat() {
  // isOverallReady: both client initialized AND server ready
  // isAuthenticated: user has valid OAuth token
  const { client, isOverallReady, isAuthenticated, login, showSetup } = useBodhi();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  // Load available models on mount
  useEffect(() => {
    if (isOverallReady && isAuthenticated) {
      loadModels();
    }
  }, [isOverallReady, isAuthenticated]);

  const loadModels = async () => {
    try {
      const modelList: string[] = [];
      for await (const model of client.models.list()) {
        modelList.push(model.id);
      }
      setModels(modelList);
      if (modelList.length > 0) {
        setSelectedModel(modelList[0]);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !selectedModel) return;

    setLoading(true);
    setResponse('');

    try {
      // Streaming chat completion with selected model
      const stream = client.chat.completions.create({
        model: selectedModel,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        setResponse(prev => prev + content);
      }
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Show setup button if not ready
  if (!isOverallReady) {
    return (
      <div>
        <p>Setup required to connect to Bodhi App server</p>
        <button onClick={showSetup}>Open Setup</button>
      </div>
    );
  }

  // Show login button if not authenticated
  if (!isAuthenticated) {
    return (
      <div>
        <p>Please login to continue</p>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  // Main chat UI
  return (
    <div>
      <div>
        <label>
          Model:
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            disabled={loading || models.length === 0}
          >
            {models.length === 0 ? (
              <option>Loading models...</option>
            ) : (
              models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))
            )}
          </select>
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Ask me anything..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !selectedModel}>
          {loading ? 'Generating...' : 'Send'}
        </button>
      </form>

      {response && (
        <div className="response">
          <h3>Response:</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default Chat;
```

## Step 4: OAuth Callback Handling

**Built-in Callback Handler (Default)**:

By default, BodhiProvider automatically handles OAuth callbacks when `handleCallback={true}` (default). The token exchange happens atomically without requiring additional setup. Your app will work without creating custom callback routes.

**Custom Callback Route (Optional)**:

If you need custom routing, create `src/Callback.tsx`:

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // BodhiProvider automatically handles the callback
    // Just redirect back to home after a brief delay
    setTimeout(() => navigate('/'), 100);
  }, [navigate]);

  return <div>Authenticating...</div>;
}

export default Callback;
```

If using React Router, add the route:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Callback from './Callback';

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/callback" element={<Callback />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Step 5: Run Your App

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173` (or your dev server URL).

## What Just Happened?

Let's break down the key parts:

### 1. Single Package Install

```bash
npm install @bodhiapp/bodhi-js-react
```

The preset package includes everything: React bindings, web client, extension detection, OAuth handling, and streaming support.

### 2. Simplified Provider Setup

```typescript
<BodhiProvider authClientId={CLIENT_ID}>
  <Chat />
</BodhiProvider>
```

Just pass your `authClientId` - no manual client creation needed! The SDK:

- Auto-creates the client
- Auto-detects extension or uses direct mode
- Configures OAuth with sensible defaults
- Handles callback processing

### 3. Using the Hook

```typescript
const { client, isOverallReady, isAuthenticated, login, showSetup } = useBodhi();
```

Access the SDK client and state from any component.

### 4. Streaming Chat (OpenAI-Style API)

```typescript
for await (const chunk of client.chat.completions.create({
  model,
  messages: [{ role: 'user', content: prompt }],
  stream: true,
})) {
  const content = chunk.choices?.[0]?.delta?.content || '';
  setResponse(prev => prev + content);
}
```

Stream chat completions using OpenAI-compatible API pattern with real-time AsyncGenerator.

## Code Comparison: Before vs After

**Old Approach (2 imports + manual client)**:

```typescript
import { WebUIClient } from '@bodhiapp/bodhi-js';
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

const bodhiClient = new WebUIClient(CLIENT_ID);

<BodhiProvider client={bodhiClient}>
  <App />
</BodhiProvider>
```

**New Approach (1 import, no client)**:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

<BodhiProvider authClientId={CLIENT_ID}>
  <App />
</BodhiProvider>
```

## Testing Your Integration

### 1. Check Connection Status

Open browser DevTools and check for logs:

```
[Bodhi/Web] Extension detected, version: 1.0.0
[Bodhi/Web] Server ready, version: 0.1.0
```

### 2. Test Setup Flow

Click "Open Setup" button to verify:

- Extension detection works
- Server connection succeeds
- Modal displays correctly

### 3. Test Authentication

Click "Login" to verify:

- OAuth redirect works
- Callback handling succeeds
- User info displayed

### 4. Test Chat

Send a message to verify:

- Streaming works
- Response renders correctly
- Error handling works

## Common Issues

### "Extension not detected"

**Cause**: Bodhi Browser extension not installed or disabled.

**Solution**:

1. Install extension from Chrome Web Store
2. Reload your app
3. Check extension is enabled in `chrome://extensions`

### "Server not reachable"

**Cause**: Bodhi App backend not running.

**Solution**:

1. Start Bodhi App backend (download from [getbodhi.app](https://getbodhi.app))
2. Verify server running at `http://localhost:1135`
3. Click "Open Setup" to reconnect

### "OAuth redirect failed"

**Cause**: Redirect URI mismatch or unregistered client ID.

**Solution**:

1. Register your app at [developer.getbodhi.app](https://developer.getbodhi.app)
2. Ensure `redirectUri` matches your registered redirect URI
3. Check for typos in client ID or configuration

### Streaming not working

**Cause**: No models loaded or model selection empty.

**Solution**:

1. Check available models at `http://localhost:1135/v1/models`
2. Download models through Bodhi App interface
3. Reload models in your app (model dropdown should update automatically)

## Next Steps

Now that you have a working integration:

- **[React Integration](./react-integration.md)** - Learn advanced React patterns
- **[Authentication](./authentication.md)** - Understand OAuth flow in depth
- **[Streaming](./streaming.md)** - Master streaming patterns
- **[Error Handling](./error-handling.md)** - Handle errors gracefully
- **[Client Injection](./advanced/client-injection.md)** - Advanced configuration and dependency injection

## Full Working Example

The complete source code for this quick start is available in the [sdk-test-app](https://github.com/BodhiSearch/bodhi-js/tree/main/sdk-test-app) directory of the repository.

---

← Back to [Installation](./installation.md) | Continue to [React Integration](./react-integration.md) →
