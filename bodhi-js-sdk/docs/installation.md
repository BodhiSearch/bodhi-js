# Installation

This guide covers installing the Bodhi JS SDK for **web applications**. For Chrome extension development, see [Extension Installation](./installation-extension.md).

## Quick Install (Recommended)

For React web applications, install the preset package:

```bash
npm install @bodhiapp/bodhi-js-react
```

This single package includes everything you need - the React bindings and the web client.

## Package Selection

Choose packages based on your use case:

| Use Case                        | Package to Install                                        |
| ------------------------------- | --------------------------------------------------------- |
| **React web app (Recommended)** | `@bodhiapp/bodhi-js-react`                                |
| **Vanilla JS/other frameworks** | `@bodhiapp/bodhi-js`                                      |
| **Advanced: Custom client**     | `@bodhiapp/bodhi-js-react-core` + `@bodhiapp/bodhi-js`    |
| **Type-only imports**           | `@bodhiapp/bodhi-js-core`                                 |
| **Chrome extensions**           | See [Extension Installation](./installation-extension.md) |

## Installing for Vanilla JavaScript

If you're not using React:

```bash
npm install @bodhiapp/bodhi-js
```

## Package Details

### @bodhiapp/bodhi-js-react (Recommended)

**React web preset - everything in one package**

- **Size**: ~65KB minified total
- **Peer Dependencies**: `react ^18.3.0 || ^19.0.0`
- **Includes**: `@bodhiapp/bodhi-js-react-core` + `@bodhiapp/bodhi-js`
- **Exports**: `BodhiProvider`, `useBodhi`, `WebUIClient`, all types

**What's included**:

- `BodhiProvider` - Auto-configured React provider (just pass `authClientId`)
- `useBodhi()` hook - Access SDK from components
- `WebUIClient` - Pre-configured web client (re-exported for advanced use)
- Automatic OAuth callback handling
- Setup modal integration
- Extension detection and direct HTTP client
- Streaming support with AsyncGenerator

**Quick example**:

```typescript
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react';

<BodhiProvider authClientId="my-app">
  <App />
</BodhiProvider>;
```

### @bodhiapp/bodhi-js

**Web SDK for vanilla JavaScript**

- **Size**: ~50KB minified
- **Dependencies**: `@bodhiapp/bodhi-js-core`, `@bodhiapp/ts-client`
- **Exports**: `WebUIClient`, `IWebUIClient`, types, build info

**What's included**:

- `WebUIClient` - Main facade client for web apps
- Extension detection via `window.bodhiext`
- Direct HTTP client for local server communication
- OAuth2 + PKCE browser redirect flow
- Streaming support with AsyncGenerator

### @bodhiapp/bodhi-js-react-core

**React bindings with dependency injection (Advanced)**

- **Size**: ~15KB minified
- **Peer Dependencies**: `react ^18.3.0 || ^19.0.0`
- **Dependencies**: `@bodhiapp/bodhi-js-core`
- **Exports**: `BodhiProvider` (requires `client` prop), `useBodhi`, types

> **Note**: Use this package only for advanced scenarios requiring custom client configuration. For most use cases, use `@bodhiapp/bodhi-js-react` preset instead. See [Client Injection](./advanced/client-injection.md).

## TypeScript Configuration

The SDK is written in TypeScript and provides full type definitions. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  }
}
```

For React projects using the SDK:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "moduleResolution": "bundler",
    "esModuleInterop": true
  }
}
```

## Bundler Configuration

### Vite

No special configuration needed. The SDK works out-of-the-box with Vite:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

### Webpack

For webpack projects, ensure you're handling ES modules:

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};
```

### Next.js

For Next.js projects, the SDK works with both Pages Router and App Router:

```javascript
// next.config.js
module.exports = {
  transpilePackages: ['@bodhiapp/bodhi-js', '@bodhiapp/bodhi-js-react'],
};
```

## Verifying Installation

After installation, verify the packages are correctly installed:

```bash
# Check installed versions
npm list @bodhiapp/bodhi-js
npm list @bodhiapp/bodhi-js-react
```

Create a simple test file to verify imports:

```typescript
// test-import.ts
import { BodhiProvider, useBodhi, WebUIClient } from '@bodhiapp/bodhi-js-react';

console.log('Imports successful!');
console.log('BodhiProvider:', BodhiProvider);
console.log('WebUIClient:', WebUIClient);
console.log('useBodhi:', useBodhi);
```

Run with:

```bash
npx tsx test-import.ts
# or
node --loader tsx test-import.ts
```

## Troubleshooting

### "Cannot find module '@bodhiapp/bodhi-js'"

**Solution**: Ensure you've installed the package:

```bash
npm install @bodhiapp/bodhi-js
```

### "Module not found: Can't resolve '@bodhiapp/bodhi-js-core'"

**Cause**: Missing peer dependency.

**Solution**: Install the web or extension SDK, which will automatically install core:

```bash
npm install @bodhiapp/bodhi-js
```

### TypeScript errors about missing types

**Solution**: Ensure `skipLibCheck` is disabled or install @types packages:

```bash
npm install -D @types/react @types/node
```

### Bundler issues with ES modules

**Solution**: Ensure your bundler is configured for ES modules. For webpack, add:

```javascript
module.exports = {
  resolve: {
    fullySpecified: false,
  },
};
```

## Next Steps

Now that you've installed the SDK, proceed to:

- [Quick Start](./quick-start.md) - Build your first integration
- [React Integration](./react-integration.md) - Deep dive into React usage

---

← Back to [Overview](./index.md) | Continue to [Quick Start](./quick-start.md) →
