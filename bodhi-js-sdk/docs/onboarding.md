# Onboarding & Setup Wizard

Guide users through extension installation and server configuration with the built-in setup wizard.

## Overview

The Bodhi JS SDK includes a sophisticated onboarding system that guides users through:

- **Platform Detection**: Automatically detects browser and OS
- **Extension Installation**: Guides installation from Chrome Web Store
- **Server Configuration**: Tests connection to local LLM server
- **Connection Mode Selection**: Chooses between extension and direct mode
- **LNA Permission**: Handles Local Network Access permissions (Chrome 130+)

## Quick Start

### Using the Setup Modal

```typescript
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function App() {
  const { isOverallReady, showSetup } = useBodhi();

  if (!isOverallReady) {
    return (
      <div>
        <h1>Setup Required</h1>
        <button onClick={showSetup}>Open Setup Wizard</button>
      </div>
    );
  }

  return <YourApp />;
}
```

## Setup Wizard Functions

### showSetup()

Opens the setup wizard modal:

```typescript
const { showSetup } = useBodhi();

// Basic usage
await showSetup();

// With error handling
try {
  await showSetup();
} catch (err) {
  console.error('Setup modal failed to load:', err);
}
```

### hideSetup()

Closes the setup wizard modal:

```typescript
const { hideSetup } = useBodhi();

hideSetup();
```

### Setup State

Track the modal's lifecycle state:

```typescript
const { setupState } = useBodhi();

// setupState values:
// - 'ready': Modal not shown
// - 'loading': Modal iframe loading
// - 'loaded': Modal displayed
```

## Setup Flow

The setup wizard guides users through these steps:

### 1. Platform Detection

Automatically detects:

- **Browser**: Chrome, Edge, Brave, etc.
- **Operating System**: Windows, macOS, Linux, etc.
- **Browser Version**: For feature compatibility

```typescript
// Platform detection happens automatically
const { clientState } = useBodhi();

if (clientState.mode === 'extension') {
  // Extension-based connection
} else if (clientState.mode === 'direct') {
  // Direct HTTP connection
}
```

### 2. Extension Installation

Provides installation guidance:

- Link to Chrome Web Store
- Browser-specific instructions
- Automatic extension detection after install

**User Experience**:

1. Click "Install Extension"
2. Redirects to Chrome Web Store
3. User installs extension
4. Returns to app
5. Modal auto-detects installation

### 3. Server Installation

Confirms local LLM server is running:

- Tests connection to `http://localhost:1135`
- Validates server version
- Checks server status

**Server States**:

- `ready`: Server operational
- `setup`: Server needs initial configuration
- `resource-admin`: Server needs resource setup
- `unreachable`: Server not running or not accessible

### 4. LNA (Local Network Access) Permission

For Chrome 130+, requests permission to access localhost:

- Prompts user to grant LNA permission
- Tests direct HTTP connection
- Fallback to extension mode if denied

**LNA States**:

- `prompt`: Needs user action
- `granted`: Permission granted
- `denied`: User denied permission
- `skipped`: User chose to skip
- `unsupported`: Browser doesn't support LNA

### 5. Connection Mode Selection

User chooses connection method:

- **Extension Mode**: Via Bodhi Browser extension (recommended)
- **Direct Mode**: Direct HTTP to localhost (requires LNA)

```typescript
const { client } = useBodhi();

// Switch modes programmatically
await client.setConnectionMode('extension');
await client.setConnectionMode('direct');
```

## Custom Modal Path

If self-hosting the setup modal:

```typescript
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

<BodhiProvider
  client={client}
  modalHtmlPath="/custom/modal.html"
>
  <App />
</BodhiProvider>
```

## Programmatic Setup Testing

### Test Extension Connectivity

```typescript
const { client } = useBodhi();

const extensionState = await client.testExtensionConnectivity();

if (extensionState.extension === 'ready') {
  console.log('Extension available:', extensionState.extensionId);
  console.log('Server status:', extensionState.server.status);
} else {
  console.log('Extension not found');
}
```

### Test Direct Connectivity

```typescript
const { client } = useBodhi();

const directState = await client.testDirectConnectivity('http://localhost:1135');

if (directState.server.status === 'ready') {
  console.log('Direct connection successful');
  console.log('Server version:', directState.server.version);
} else {
  console.log('Direct connection failed:', directState.server.error);
}
```

## Conditional Setup Display

### Show Setup Only When Needed

```typescript
function ConditionalSetup() {
  const { isOverallReady, isInitializing, showSetup } = useBodhi();

  if (isInitializing) {
    return <LoadingSpinner />;
  }

  if (!isOverallReady) {
    return (
      <EmptyState
        icon={<SetupIcon />}
        title="Setup Required"
        description="Configure your connection to start using the app"
        action={<Button onClick={showSetup}>Start Setup</Button>}
      />
    );
  }

  return <MainApp />;
}
```

### Inline Setup Prompt

```typescript
function InlineSetup() {
  const { isOverallReady, showSetup, clientState } = useBodhi();

  if (isOverallReady) return null;

  return (
    <Banner severity="warning">
      <div>
        <strong>Setup Required:</strong> {clientState.status}
        <Button onClick={showSetup}>Configure</Button>
      </div>
    </Banner>
  );
}
```

## Advanced Integration

### Custom Onboarding Flow

For complete control over the onboarding experience:

```typescript
import { OnboardingModal } from '@bodhiapp/bodhi-js-core';

function CustomOnboarding() {
  const modalRef = useRef<OnboardingModal | null>(null);

  const startCustomFlow = async () => {
    const modal = new OnboardingModal(
      '/path/to/modal.html',
      'bodhi-setup-modal'
    );

    await modal.load();
    modalRef.current = modal;

    // Listen for completion
    modal.onComplete(() => {
      console.log('Setup completed');
      modal.remove();
    });
  };

  return <button onClick={startCustomFlow}>Start Custom Setup</button>;
}
```

### Handling Setup Completion

```typescript
function SetupWithCallback() {
  const { showSetup, isOverallReady } = useBodhi();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOverallReady) {
      // Setup completed, redirect to main app
      navigate('/dashboard');
    }
  }, [isOverallReady, navigate]);

  return (
    <div>
      <button onClick={showSetup}>Configure Connection</button>
    </div>
  );
}
```

## Troubleshooting Setup

### Extension Not Detected

**Cause**: Extension not installed or disabled

**Solutions**:

1. Install from Chrome Web Store
2. Enable in `chrome://extensions`
3. Reload the page
4. Check extension compatibility

### Server Not Reachable

**Cause**: Bodhi App backend not running

**Solutions**:

1. Start Bodhi App backend (download from [getbodhi.app](https://getbodhi.app))
2. Verify server URL (default: `http://localhost:1135`)
3. Check firewall settings
4. Try direct mode with LNA permission

### LNA Permission Denied

**Cause**: User denied Local Network Access

**Solutions**:

1. Use extension mode instead
2. Grant permission in Chrome settings: `chrome://settings/content/localNetworkAccess`
3. Reload page and retry setup

### Setup Modal Won't Load

**Cause**: Modal HTML not found

**Solutions**:

1. Verify `modalHtmlPath` configuration
2. Check network requests in DevTools
3. Ensure modal file is accessible from your domain
4. Check CORS settings if hosting externally

## Server Configuration

### Default Server URL

```typescript
// Auto-detects: http://localhost:1135
const client = new WebUIClient('client-id');
```

### Custom Server URL

```typescript
// Test custom server
const directState = await client.testDirectConnectivity('http://localhost:1135');

if (directState.server.status === 'ready') {
  // Bodhi App server is accessible
}
```

## Best Practices

### 1. Show Setup Immediately

```typescript
// ✅ DO show setup as first screen if not ready
function App() {
  const { isOverallReady, showSetup } = useBodhi();

  useEffect(() => {
    if (!isOverallReady) {
      showSetup();
    }
  }, [isOverallReady, showSetup]);

  return isOverallReady ? <MainApp /> : <SetupScreen />;
}
```

### 2. Provide Context

```typescript
// ✅ DO explain why setup is needed
<EmptyState
  title="Connection Setup Required"
  description="We need to connect to your local AI server to provide intelligent responses."
  action={<Button onClick={showSetup}>Start Setup</Button>}
/>
```

### 3. Handle Setup Abandonment

```typescript
function SetupWithFallback() {
  const { showSetup, setupState } = useBodhi();
  const [abandoned, setAbandoned] = useState(false);

  useEffect(() => {
    if (setupState === 'ready' && !abandoned) {
      // User closed modal without completing
      const timer = setTimeout(() => setAbandoned(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [setupState, abandoned]);

  if (abandoned) {
    return (
      <Alert severity="info">
        Setup incomplete. You can <a onClick={showSetup}>resume setup</a> anytime.
      </Alert>
    );
  }
}
```

### 4. Persist Connection Preference

```typescript
// The SDK automatically persists connection mode
// User's choice is remembered across sessions

const { clientState } = useBodhi();
console.log('Preferred mode:', clientState.mode);
// 'extension' or 'direct' based on user's last choice
```

## Advanced: Custom Modal Implementation

For SDK contributors or custom modal implementations, see the [Modal Protocol Internals](./internals/modal-protocol.md) documentation.

## Auto-Detection Behavior

The setup wizard includes intelligent auto-detection:

### Automatic Server Installation Confirmation

When the server becomes reachable (status: `ready`, `setup`, or `resource-admin`) from EITHER extension or direct connection, the wizard automatically marks server installation as confirmed.

### Automatic Connection Mode Selection

When `connectionMode` is `null` (fresh install), the wizard auto-selects the best mode:

**Priority Order**:

1. **Direct mode** (lower latency) - if server reachable via direct connection
2. **Extension mode** - if server reachable via extension

User's selection is persisted for future sessions.

### LNA State Derivation

The LNA (Local Network Access) state is derived from:

- Direct server connectivity test results
- User preferences (granted, skipped, denied)
- Server reachability (ready, setup, resource-admin → 'granted')

This ensures the wizard accurately reflects actual connection state rather than static prompts.

## Next Steps

- **[Client State](./client-state.md)** - Understanding connection modes
- **[Error Handling](./error-handling.md)** - Handling setup errors
- **[API Reference](./api-reference.md)** - Complete API documentation

---

← Back to [Streaming](./streaming.md) | Continue to [Client State](./client-state.md) →
