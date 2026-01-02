# TECH.md - React SDK Technical Reference

## React Library Configuration

### JSX Transform Configuration

**TypeScript Configuration** (`tsconfig.json`):

```json
{
  "jsx": "react-jsx" // Modern JSX transform (React 17+)
}
```

**Critical**: Use `"react-jsx"` NOT `"react"`:

- `"react"` - Old transform, requires `import React from 'react'` in every file
- `"react-jsx"` - Automatic transform, no React import needed for JSX

**Reference**: [React Docs - New JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html)

### Rollup External Dependencies

**Configuration** (`rollup.config.js`):

```javascript
external: (id) => {
  if (id === 'react' || id === 'react/jsx-runtime' || id === 'react-dom') return true;
  if (id.startsWith('@bodhiapp/bodhi-js-core')) return true;
  if (id.startsWith('@bodhiapp/ts-client')) return true;
  return false;
};
```

**Critical External Dependencies**:

1. `react` - Core React library
2. `react/jsx-runtime` - JSX transformation runtime
3. `react-dom` - React DOM renderer

**Why External**: React libraries should NOT bundle React or its runtime. These are provided by the consuming application via `peerDependencies`.

**Symptom if Bundled**: "React is not defined" errors when library tries to use bundled JSX runtime that expects React to be available.

### React Type Imports

**Correct Pattern**:

```typescript
import { useState, useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode; // ✓ Correct
}
```

**Incorrect Pattern**:

```typescript
import { useState, useEffect } from 'react';

interface Props {
  children: React.ReactNode; // ✗ Wrong - React not imported
}
```

**Rule**: Import types you use. Don't reference `React.` namespace unless you import React.

## Chrome Extension Usage

### Preventing Duplicate React Instances

When using `@bodhiapp/bodhi-js-react` in a Chrome extension with crxjs or similar bundlers, add `resolve.dedupe` to prevent duplicate React instances:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
});
```

**Why This Is Needed**:

- Chrome extension bundlers (crxjs, etc.) may resolve React from multiple locations
- Even without React in SDK's `devDependencies`, bundler resolution can find duplicates
- Extension bundler might resolve React differently than standard Vite
- Result: Two React copies → "Invalid hook call" errors

**Symptom Without Dedupe**:

```
Warning: Invalid hook call. Hooks can only be called inside of the body of a function component.
You might have more than one copy of React in the same app
TypeError: Cannot read properties of null (reading 'useRef')
```

**How Dedupe Works**: Forces all React imports to resolve to single instance from root node_modules, even when extension bundler has different resolution behavior than standard Vite.

**Reference**: See December 2024 fix for sdk-test-app Chrome extension integration.

## Common Issues & Solutions

### Issue: "React is not defined"

**Symptoms**:

- Blank page, no rendering
- Console error: `ReferenceError: React is not defined`
- Error at JSX usage sites

**Root Causes**:

1. Old JSX transform (`"jsx": "react"`) without React import
2. Using `React.ReactNode` without importing React
3. Bundling JSX runtime instead of marking it external

**Solution**:

1. Set `"jsx": "react-jsx"` in tsconfig.json
2. Import types explicitly: `import { type ReactNode } from 'react'`
3. Add `react/jsx-runtime` to rollup external
4. Rebuild package

**Reference**: See December 2024 fix for initial SDK extraction

### Issue: Bundled React Runtime

**Symptom**: Built dist file contains:

```javascript
import require$$0, { useMemo } from 'react';
// ... bundled JSX runtime code ...
```

**Expected**: Built dist file should have:

```javascript
import { jsxs, jsx } from 'react/jsx-runtime';
import { useMemo, useRef } from 'react';
```

**Fix**: Add `react/jsx-runtime` to rollup external array

## Package Structure

### Dependencies

**Runtime Dependencies** (`dependencies`):

- `@bodhiapp/bodhi-js-core` - Core types/interfaces (file:../core)
- `@bodhiapp/ts-client` - API client types

**Peer Dependencies** (`peerDependencies`):

- `react: ^18.3.0 || ^19.0.0` - React library (provided by consumer)

**Dev Dependencies**:

- `@types/react: ^19.0.0` - React type definitions for TypeScript
- `rollup` + plugins - Build toolchain

**CRITICAL**: React should NOT be in devDependencies for React libraries:

- React is provided by consuming app via peerDependencies
- Including React in devDependencies creates `node_modules/@bodhiapp/bodhi-js-react/node_modules/react`
- Chrome extension bundlers (crxjs) may resolve React from SDK's node_modules → duplicate React copies
- Result: "Invalid hook call" errors in extension builds
- Only `@types/react` needed for TypeScript type checking during development

### Build Output

**Formats**:

- `dist/bodhi-react.cjs.js` - CommonJS (Node.js)
- `dist/bodhi-react.esm.js` - ES Modules (bundlers)

**Exports** (`package.json`):

```json
{
  "main": "dist/bodhi-react.cjs.js",
  "module": "dist/bodhi-react.esm.js",
  "exports": {
    ".": {
      "import": "./dist/bodhi-react.esm.js",
      "require": "./dist/bodhi-react.cjs.js"
    }
  }
}
```

## Testing React Library Integration

### Vite Dev Mode Testing

**How Vite Resolves**:

1. `@bodhiapp/bodhi-js-react` in sdk-test-app package.json
2. Symlink: `node_modules/@bodhiapp/bodhi-js-react` → `../bodhi-js-sdk/react`
3. Vite loads from `dist/bodhi-react.esm.js` (built file)

**Important**: Changes to React SDK source require rebuild:

```bash
cd bodhi-js-sdk/react
npm run build
# Vite dev server picks up new dist file automatically
```

### Verification Steps

After making changes to React SDK:

1. **Rebuild Package**:

   ```bash
   cd bodhi-js-sdk/react
   npm run build
   ```

2. **Check Built File**:

   ```bash
   head -10 dist/bodhi-react.esm.js
   ```

   Should see:

   ```javascript
   import { jsxs, jsx } from 'react/jsx-runtime';
   ```

3. **Reload Browser**:
   - Hard reload (Cmd+Shift+R) to clear Vite cache
   - Check console for errors
   - Verify UI renders

## Best Practices

### React Library Development

1. **Always use automatic JSX transform** (`"jsx": "react-jsx"`)
2. **Mark React as external** (peer dependency, not bundled)
3. **Mark JSX runtime as external** (`react/jsx-runtime`)
4. **Import types explicitly** (don't use React.Type pattern)
5. **Test in consuming app** (not just isolation)

### Debugging Tips

**Blank Page**:

- Check browser console for errors
- Verify built dist file has correct JSX runtime import
- Check network tab - is dist file loading?
- Verify tsconfig jsx setting

**"React is not defined"**:

- Check rollup external config
- Verify JSX transform in tsconfig
- Check for `React.` type references without import

**Build succeeds but app fails**:

- Check if JSX runtime is bundled (should be external)
- Verify React is in peerDependencies
- Rebuild and hard reload browser

## December 2024 SDK Extraction Notes

### Issues Encountered

1. **Initial Error**: "React is not defined at BodhiProvider.tsx:209"
   - Cause: Using old JSX transform + React.ReactNode without import
   - Fix: Changed to `react-jsx` transform + imported ReactNode type

2. **Bundled JSX Runtime**: Built file contained JSX runtime code
   - Cause: Missing `react/jsx-runtime` from external array
   - Fix: Added to rollup external config

3. **Stale Dependencies**: `@bodhiapp/setup-modal` in package.json
   - Cause: Leftover from before setup-modal copyable types refactor
   - Fix: Removed dependency (now using core's copied types)

4. **Chrome Extension "Invalid Hook Call"**: Extension mode failing with duplicate React
   - Cause: crxjs bundler resolving React from multiple locations
   - Fix: Added `resolve.dedupe` to sdk-test-app/vite.config.ts
   - Additional improvement: Removed React from SDK devDependencies (still requires dedupe)

5. **React Version Upgrade**: Upgraded to React 19 types
   - `@types/react`: ^18.3.18 → ^19.0.0
   - Removed `react: ^18.3.1` from devDependencies
   - Only types needed for development, not React itself

### Files Modified

- `tsconfig.json` - Changed jsx to react-jsx
- `src/BodhiProvider.tsx` - Added ReactNode import, removed React. prefix
- `rollup.config.js` - Added react/jsx-runtime to external
- `package.json` - Removed setup-modal dependency, upgraded @types/react to ^19.0.0, removed React from devDependencies
- `sdk-test-app/vite.config.ts` - Added resolve.dedupe for Chrome extension compatibility

### Verification

All changes verified in sdk-test-app:

- App loads without errors ✓
- UI renders correctly ✓
- No console errors ✓
- Extension integration works ✓

## References

- [React 17 JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html)
- [Building React Libraries](https://www.freecodecamp.org/news/build-and-publish-a-react-component-library-with-rollup/)
- [Rollup External Config](https://rollupjs.org/configuration-options/#external)

---

# Setup Modal State Behavior

Non-obvious behaviors and complex logic patterns in SetupModalProcessor.

## State Flow Architecture

### Initialization Flow (BodhiProvider → Modal)

```
User navigates to page
    ↓
BodhiProvider.init() (auto on mount)
    ↓
client.init({ testConnection: true }) - restores connectionMode from storage
    ↓
StateChangeCallback fired → setClientState(ClientState)
    ↓
User calls showSetup()
    ↓
setSetupState('loading') → SetupModalProcessor becomes visible
    ↓
buildSetupState(forceRefresh=true)
    ├─ detectBrowser/OS
    ├─ testExtensionConnectivity() - always on launch
    ├─ testDirectConnectivity() - only if directStatus='granted'
    ├─ auto-confirm server if reachable
    └─ auto-select connectionMode if null
    ↓
modalRef.show(SetupState) → iframe loads
    ↓
Modal: selectDeterminedStep(state) → shows initial step
```

## Critical Design Decisions

### Server Confirmation Auto-Detection

**Why peculiar**: Server install step auto-completes WITHOUT user interaction.

**Logic**: `isServerReachable()` checks BOTH extension AND direct states for ready/setup/resource-admin. If either path reaches server, auto-confirms.

**Rationale**: User shouldn't manually confirm what system can detect.

### LNA State Derivation (NOT Hardcoded)

`buildLnaState()` derives state from `directState.server.status` + `directStatus` pref:

- `directStatus='skipped'` → `status='skipped'`
- `directState.server.status='ready'` → `status='granted'`
- `directStatus='granted'` + `server.status='not-connected'` → `status='granted'` (not yet tested)
- Default → `status='prompt'`

### Conditional Direct Testing

Direct connectivity tested ONLY if `directStatus === 'granted'` OR `forceRefresh=true`.

**Why**: Avoids network errors in console before user grants LNA.

### Two-Path Architecture

Modal supports TWO independent completion paths (LNA OR Extension):

- `selectDeterminedStep()` → which step to SHOW (active step)
- `selectStepStatus(step)` → visual status badge for ANY step

These operate independently. Step 5 can show while step 3 shows incomplete badge.

## State Building

### buildSetupState(forceRefresh)

**forceRefresh=false** (default):

- Extension: Test if `extension='not-initialized'` only
- Direct: Test if `directStatus='granted'` AND `server.status='not-connected'`

**forceRefresh=true** (MODAL_REFRESH):

- Extension: Always test
- Direct: Test if `directStatus='granted'`

### getStateWithOverrides()

Applies cached overrides for instant updates without full rebuild:

- `userConfirmations.serverInstall` ← `prefs.isServerInstallConfirmed()`
- `selectedConnection` ← `client.getConnectionMode()`

## Debugging

- **"Server confirmed but step shows incomplete"**: Handler didn't call `buildSetupState()` after modifying prefs
- **"selectedConnection not updating"**: Using raw `currentStateRef.current` instead of `getStateWithOverrides()`
- **"LNA shows 'prompt' but directStatus='granted'"**: Direct not tested this session, check pref value
