# Extension Installation

This guide covers installing the Bodhi JS SDK for **Chrome extension development**. For web applications, see [Installation](./installation.md).

## Quick Install (Recommended)

For React-based Chrome extensions, install the preset package:

```bash
npm install @bodhiapp/bodhi-js-react-ext
```

This single package includes everything you need - React bindings and the extension client.

## Package Selection

Choose packages based on your extension type:

| Extension Type                             | Package to Install                                         |
| ------------------------------------------ | ---------------------------------------------------------- |
| **Popup/Options with React (Recommended)** | `@bodhiapp/bodhi-js-react-ext`                             |
| **Popup/Options vanilla JS**               | `@bodhiapp/bodhi-js-ext`                                   |
| **Background script**                      | `@bodhiapp/bodhi-js-ext` (BodhiExtClient)                  |
| **Advanced: Custom client**                | `@bodhiapp/bodhi-js-react-core` + `@bodhiapp/bodhi-js-ext` |

## Installing for Chrome Extensions

### Step 1: Install NPM Packages

```bash
# For React extensions (recommended)
npm install @bodhiapp/bodhi-js-react-ext

# Or for vanilla JS extensions
npm install @bodhiapp/bodhi-js-ext
```

### Step 2: Run Setup Modal CLI (Critical)

**This step is mandatory** for the setup wizard to work in your extension:

```bash
npx @bodhiapp/bodhi-js-core setup-modal
```

**What this command does**:

1. Copies `setup-modal.html` to your extension's root directory
2. Automatically updates your `manifest.json` to add required `web_accessible_resources` entry
3. Ensures the setup wizard can be displayed in your extension

**Without this step**, the onboarding flow will fail with modal loading errors.

### Step 3: Verify manifest.json

After running the CLI, your `manifest.json` should include:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",

  "permissions": [
    "storage", // For chrome.storage.session
    "identity" // For chrome.identity OAuth flow
  ],

  "host_permissions": [
    "https://id.getbodhi.app/*" // OAuth server access
  ],

  "web_accessible_resources": [
    {
      "resources": ["setup-modal.html"],
      "matches": ["<all_urls>"]
    }
  ],

  "action": {
    "default_popup": "popup.html"
  },

  "options_page": "options.html"
}
```

## Package Details

### @bodhiapp/bodhi-js-react-ext (Recommended)

**React extension preset - everything in one package**

- **Size**: ~60KB minified total
- **Peer Dependencies**: `react ^18.3.0 || ^19.0.0`
- **Includes**: `@bodhiapp/bodhi-js-react-core` + `@bodhiapp/bodhi-js-ext`
- **Exports**: `BodhiProvider`, `useBodhi`, `ExtUIClient`, `BodhiExtClient`, all types

**What's included**:

- `BodhiProvider` - Auto-configured React provider (just pass `authClientId`)
- `useBodhi()` hook - Access SDK from extension components
- `ExtUIClient` - Pre-configured extension client (re-exported for advanced use)
- `BodhiExtClient` - Background script client for ext2ext communication
- chrome.runtime messaging and chrome.identity OAuth
- Automatic OAuth callback handling
- Setup modal integration
- Port-based streaming support

**Quick example**:

```tsx
import { BodhiProvider, useBodhi } from '@bodhiapp/bodhi-js-react-ext';

<BodhiProvider authClientId="my-extension">
  <ExtensionUI />
</BodhiProvider>;
```

### @bodhiapp/bodhi-js-ext

**Extension SDK for vanilla JavaScript**

- **Size**: ~45KB minified
- **Dependencies**: `@bodhiapp/bodhi-js-core`, `@bodhiapp/ts-client`
- **Exports**: `ExtUIClient`, `BodhiExtClient`, message types, constants, build info

**What's included**:

- `ExtUIClient` - Facade client for extension popup/options UI
- `BodhiExtClient` - Background script client for ext2ext communication
- chrome.runtime messaging integration
- chrome.identity OAuth flow
- Port-based streaming support

### @bodhiapp/bodhi-js-react-core

**React bindings with dependency injection (Advanced)**

- **Size**: ~15KB minified
- **Peer Dependencies**: `react ^18.3.0 || ^19.0.0`
- **Dependencies**: `@bodhiapp/bodhi-js-core`
- **Exports**: `BodhiProvider` (requires `client` prop), `useBodhi`, types

> **Note**: Use this package only for advanced scenarios requiring custom client configuration. For most use cases, use `@bodhiapp/bodhi-js-react-ext` preset instead. See [Client Injection](./advanced/client-injection.md).

## TypeScript Configuration

The SDK is written in TypeScript and provides full type definitions. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "types": ["chrome"]
  }
}
```

For React-based extensions:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "types": ["chrome"]
  }
}
```

## Bundler Configuration

### Vite (Recommended for Extensions)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  entry: {
    popup: './src/popup.tsx',
    options: './src/options.tsx',
    background: './src/background.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
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

## Verifying Installation

After installation, verify everything is set up correctly:

### 1. Check Files

Verify `setup-modal.html` exists in your extension root:

```bash
ls setup-modal.html
```

### 2. Check manifest.json

Verify `web_accessible_resources` includes `setup-modal.html`:

```bash
grep -A 5 "web_accessible_resources" manifest.json
```

### 3. Test Import

Create a test file to verify imports work:

```typescript
// test-import.ts
import { BodhiProvider, useBodhi, ExtUIClient } from '@bodhiapp/bodhi-js-react-ext';

console.log('Imports successful!');
console.log('BodhiProvider:', BodhiProvider);
console.log('ExtUIClient:', ExtUIClient);
console.log('useBodhi:', useBodhi);
```

Run with:

```bash
npx tsx test-import.ts
```

## Troubleshooting

### "Cannot find module '@bodhiapp/bodhi-js-ext'"

**Solution**: Ensure you've installed the package:

```bash
npm install @bodhiapp/bodhi-js-ext
```

### "setup-modal.html not found"

**Cause**: Forgot to run the setup-modal CLI.

**Solution**: Run the CLI tool:

```bash
npx @bodhiapp/bodhi-js-core setup-modal
```

### "Modal fails to load in extension"

**Cause**: Missing or incorrect `web_accessible_resources` in manifest.json.

**Solution**: Re-run the CLI tool which will update manifest.json:

```bash
npx @bodhiapp/bodhi-js-core setup-modal
```

### TypeScript errors about chrome types

**Solution**: Install Chrome types:

```bash
npm install -D @types/chrome
```

And add to tsconfig.json:

```json
{
  "compilerOptions": {
    "types": ["chrome"]
  }
}
```

### "Permission denied" errors in extension

**Cause**: Missing permissions in manifest.json.

**Solution**: Ensure manifest.json includes required permissions:

```json
{
  "permissions": ["storage", "identity"],
  "host_permissions": ["https://id.getbodhi.app/*"]
}
```

## Next Steps

Now that you've installed the SDK for your extension, proceed to:

- **[Extension SDK Guide](./extension-sdk.md)** - Complete extension development guide
- [Quick Start](./quick-start.md) - Build your first integration (applies to extensions too)
- [React Integration](./react-integration.md) - React patterns for extensions

---

← Back to [Installation](./installation.md) | Continue to [Extension SDK](./extension-sdk.md) →
