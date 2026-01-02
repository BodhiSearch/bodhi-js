# Bodhi JS SDK Developer Guide

Welcome to the Bodhi JS SDK - a comprehensive TypeScript SDK for integrating your web applications with the **Bodhi App backend**, a security-focused local LLM server.

## What is Bodhi JS SDK?

The Bodhi JS SDK enables web applications and browser extensions to securely communicate with the **Bodhi App backend** running on your users' machines/network/internet. It provides enterprise-grade OAuth 2.1-jwt authentication for connecting with LLM services.

**Key Benefits**:

- **Enterprise Security**: OAuth 2.1-jwt tokens, resource client ID verification, privilege-based access control
- **Privacy-First**: All AI processing happens on your deployed server by Open Source LLMs - no data sent to cloud services
- **Production-Ready**: Full TypeScript support, comprehensive error handling, automatic token refresh
- **Framework Agnostic**: Core packages work with any framework; React bindings included
- **Dual Connection Modes**: Extension-mediated or direct HTTP connection (with LNA: Local Network Access)
- **Streaming Support**: Real-time chat completions with AsyncGenerator pattern

## Security Architecture

The Bodhi App provides enterprise-grade security for locally running LLM servers:

- **Resource Client ID**: Every Bodhi App server instance is registered with a unique resource client ID
- **OAuth 2.1-jwt**: All important endpoints require access tokens with privilege verification
- **App Client Verification**: Web apps and extensions must be registered to receive an app/extension client ID
- **User Confirmation**: All access requires explicit user confirmation before tokens are granted
- **Short-lived Tokens**: Access tokens expire quickly; refresh tokens enable seamless renewal
- **Continuous Monitoring**: All access is authenticated and authorized for audit trails

This architecture ensures your locally running LLM server is protected from unauthorized access and remote code execution, even when exposing endpoints to web applications.

## Architecture

The SDK implements a three-tier architecture:

```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────────┐      ┌─────────────────┐
│   Web App       │ ───> │  Bodhi JS SDK    │ ───> │ Browser Extension │ ───> │ Local LLM Server│
│   (Your App)    │      │  (@bodhiapp/*)   │      │ (bodhi-browser)   │      │ (localhost:1135)│
└─────────────────┘      └──────────────────┘      └───────────────────┘      └─────────────────┘
        │                         │                         │                         │
    React UI          Factory Pattern         Service Worker               OpenAI-compatible
    Components        Client Abstraction       Message Passing                  API
```

### Connection Modes

The SDK supports two connection modes:

1. **Extension Mode** (Recommended - Reliable)
   - Communicates via `window.bodhiext` API injected by Bodhi Browser extension
   - Chrome runtime messaging for extension-to-server communication
   - Consistent across all browsers (Chrome, Edge, Brave)
   - Safari support coming soon
   - Automatic extension detection and installation guidance

2. **Direct Mode** (Experimental - LNA)
   - Direct HTTP connection using Local Network Access (LNA) permission
   - Chrome 130+ feature for accessing localhost from web pages
   - Experimental and can be flaky - not supported in all browsers
   - Useful for development when extension unavailable
   - Extension mode provides reliable fallback
   - Same API interface, transparent to your application

The SDK automatically manages connection mode selection and abstracts the complexity - you don't need to worry about these details.

## SDK Packages

The Bodhi JS SDK is published as a monorepo with six npm packages:

| Package                                                                                      | Purpose                                                  | Use When                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| [@bodhiapp/bodhi-js-react](https://www.npmjs.com/package/@bodhiapp/bodhi-js-react)           | **React web preset** - Auto-configured WebUIClient       | React web apps (Recommended)   |
| [@bodhiapp/bodhi-js-react-ext](https://www.npmjs.com/package/@bodhiapp/bodhi-js-react-ext)   | **React extension preset** - Auto-configured ExtUIClient | React Chrome extensions        |
| [@bodhiapp/bodhi-js](https://www.npmjs.com/package/@bodhiapp/bodhi-js)                       | Web SDK - window.bodhiext integration                    | Vanilla JS web apps            |
| [@bodhiapp/bodhi-js-ext](https://www.npmjs.com/package/@bodhiapp/bodhi-js-ext)               | Extension SDK - chrome.runtime integration               | Vanilla JS Chrome extensions   |
| [@bodhiapp/bodhi-js-react-core](https://www.npmjs.com/package/@bodhiapp/bodhi-js-react-core) | React bindings with DI pattern                           | Advanced: custom client config |
| [@bodhiapp/bodhi-js-core](https://www.npmjs.com/package/@bodhiapp/bodhi-js-core)             | Core types and interfaces                                | Type-only imports              |

**Dependency Flow**:

```
@bodhiapp/bodhi-js-react-ext → @bodhiapp/bodhi-js-react-core → @bodhiapp/bodhi-js-core
                             ↘ @bodhiapp/bodhi-js-ext ────────↗

@bodhiapp/bodhi-js-react ────→ @bodhiapp/bodhi-js-react-core → @bodhiapp/bodhi-js-core
                             ↘ @bodhiapp/bodhi-js ────────────↗
```

**Recommended Packages**:

- **Web apps with React**: Install `@bodhiapp/bodhi-js-react` (single package)
- **Chrome extensions with React**: Install `@bodhiapp/bodhi-js-react-ext` (single package)
- **Advanced use cases**: See [Client Injection](./advanced/client-injection.md) for dependency injection pattern

## Prerequisites

Before integrating the SDK, ensure you have:

1. **Node.js**: Version 18 or higher
2. **Bodhi App Backend**: Local LLM server running on `http://localhost:1135`
   - Download from [getbodhi.app](https://getbodhi.app)
   - Exposes OpenAI-compatible API endpoints
   - Includes enterprise-grade OAuth 2.1-jwt security
3. **Bodhi Browser Extension** (Optional): For extension connection mode
   - Only required if testing extension-based connectivity
   - Install from [Chrome Web Store](https://chromewebstore.google.com/detail/bodhi-browser-extension/bjdjhiombmfbcoeojijpfckljjghmjbf)
   - Direct mode (LNA) works without extension

## Quick Navigation

### Getting Started

- [Installation](./installation.md) - Add SDK packages to your project
- [Quick Start](./quick-start.md) - Build your first integration in 5 minutes

### Integration Guides

- [React Integration](./react-integration.md) - BodhiProvider, useBodhi hook, and React patterns
- [Authentication](./authentication.md) - OAuth2 + PKCE flow for authenticated requests
- [API Requests](./api-requests.md) - Making API calls to local LLM server
- [Streaming](./streaming.md) - Real-time chat completions with AsyncGenerator
- [Onboarding](./onboarding.md) - Setup wizard and user onboarding flow

### Advanced Topics

- [Client State Management](./client-state.md) - Connection modes, state types, and persistence
- [Error Handling](./error-handling.md) - Type-safe error handling patterns
- [Extension SDK](./extension-sdk.md) - Building Chrome extensions with Bodhi JS SDK

### Reference

- [API Reference](./api-reference.md) - Complete API documentation

## Typical Integration Flow

For most React web applications, your integration will follow this pattern:

```typescript
// 1. Install packages
// npm install @bodhiapp/bodhi-js @bodhiapp/bodhi-js-react

// 2. Create client instance
import { WebUIClient } from '@bodhiapp/bodhi-js';

const client = new WebUIClient('your-client-id');

// 3. Wrap app with BodhiProvider
import { BodhiProvider } from '@bodhiapp/bodhi-js-react';

function App() {
  return (
    <BodhiProvider client={client}>
      <YourApp />
    </BodhiProvider>
  );
}

// 4. Use SDK in components
import { useBodhi } from '@bodhiapp/bodhi-js-react';

function ChatComponent() {
  const { client, isOverallReady, isAuthenticated } = useBodhi();

  // Make API calls...
}
```

See [Quick Start](./quick-start.md) for a complete working example.

## Feature Highlights

### 🤝 OpenAI SDK Compatibility

Familiar API patterns for developers coming from OpenAI SDK - same namespaced structure like `client.chat.completions.create()`, `client.models.list()`, and `client.embeddings.create()` for a smooth developer experience.

### 🔐 OAuth2 + PKCE Authentication

Secure authentication flow with automatic token refresh and user info extraction.

### 🌊 Streaming Support

Real-time chat completions using modern AsyncGenerator pattern for optimal UX.

### 🎯 Type-Safe Error Handling

Discriminated unions and type guards for compile-time safety and runtime reliability.

### 🧩 Setup Wizard

Built-in onboarding modal guides users through extension installation and server configuration.

### 📦 Framework Agnostic

Core SDK works with any JavaScript framework; React bindings provided for convenience.

### 🔄 Automatic Reconnection

Smart connection management with automatic mode detection and fallback strategies.

## Example Applications

The SDK repository includes a comprehensive reference implementation:

- **[sdk-test-app](https://github.com/BodhiSearch/bodhi-js/tree/main/sdk-test-app)**: Full-featured test application demonstrating all SDK capabilities
  - Dual-mode testing (extension + direct)
  - OAuth2 authentication flow
  - Chat streaming with model selection
  - Setup wizard integration
  - Error handling patterns

## Support & Resources

- **GitHub Repository**: [github.com/BodhiSearch/bodhi-js](https://github.com/BodhiSearch/bodhi-js)
- **Issue Tracker**: [GitHub Issues](https://github.com/BodhiSearch/bodhi-js/issues)
- **NPM Packages**: [@bodhiapp on npm](https://www.npmjs.com/org/bodhiapp)
- **Developer Portal**: [developer.getbodhi.app](https://developer.getbodhi.app) - Register your app/extension

## License

The Bodhi JS SDK is open source software licensed under the [MIT License](https://github.com/BodhiSearch/bodhi-js/blob/main/LICENSE).

---

Ready to get started? Head over to [Installation](./installation.md) →
