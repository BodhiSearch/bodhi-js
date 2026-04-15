# Authentication & Deployment

## OAuth Configuration

### Dev Environment (localhost)

```tsx
<BodhiProvider
  authClientId="your-client-id"
  clientConfig={{
    authServerUrl: 'https://main-id.getbodhi.app/realms/bodhi',
  }}
>
```

- Auth server: `https://main-id.getbodhi.app/realms/bodhi`
- Allows `localhost` redirect URIs
- Register at: https://developer.getbodhi.app

### Prod Environment (real domains only)

```tsx
<BodhiProvider
  authClientId="your-client-id"
  clientConfig={{
    authServerUrl: 'https://id.getbodhi.app/realms/bodhi',
    redirectUri: 'https://yourdomain.com/callback',
  }}
>
```

- Auth server: `https://id.getbodhi.app/realms/bodhi`
- Requires registered domain as redirect URI

### OAuth Flow

The SDK uses OAuth 2.0 + PKCE. BodhiProvider handles the full flow automatically:

1. `login()` constructs auth URL with PKCE challenge and redirects browser
2. User authenticates at auth server
3. Browser redirects back with `code` and `state` params
4. BodhiProvider (with `handleCallback={true}`) intercepts the callback URL
5. SDK exchanges code for tokens using PKCE verifier
6. URL is cleaned via `history.replaceState()` (no page reload)
7. Auth state updates to `authenticated`

No custom routes or callback handlers needed.

### Auth Scopes

Default scope: `openid profile email roles scope_user_user`

The SDK auto-appends a resource scope from the server (`scope_resource_{id}`) to scope tokens to the specific server instance.

### handleOAuthCallback (Advanced)

If you disable auto-callback (`handleCallback={false}`), handle it manually:

```tsx
import { isWebUIClient } from '@bodhiapp/bodhi-js-react';

// In your callback route:
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const state = params.get('state');

if (code && state && isWebUIClient(client)) {
  await client.handleOAuthCallback(code, state);
}
```

## GitHub Pages Deployment

### Vite Config

```typescript
// vite.config.ts
export default defineConfig({
  base: '/your-repo-name/',
  // ...
});
```

### BodhiProvider basePath

```tsx
<BodhiProvider
  authClientId="your-client-id"
  basePath="/your-repo-name"
>
```

The `callbackPath` auto-computes to `/your-repo-name/callback`.

### SPA Routing (404.html Hack)

GitHub Pages doesn't support SPA routing natively. Create a `public/404.html` that redirects to `index.html` preserving the path:

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // Redirect 404s to index.html for SPA routing
      var pathSegmentsToKeep = 1; // 1 for project pages, 0 for user pages
      var l = window.location;
      l.replace(
        l.protocol +
          '//' +
          l.hostname +
          (l.port ? ':' + l.port : '') +
          l.pathname
            .split('/')
            .slice(0, 1 + pathSegmentsToKeep)
            .join('/') +
          '/?/' +
          l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
          (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
          l.hash
      );
    </script>
  </head>
  <body></body>
</html>
```

And in `index.html`, add a script to restore the path:

```html
<script>
  (function (l) {
    if (l.search[1] === '/') {
      var decoded = l.search
        .slice(1)
        .split('&')
        .map(function (s) {
          return s.replace(/~and~/g, '&');
        })
        .join('?');
      window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
    }
  })(window.location);
</script>
```

## Multi-Tenant Detection

The server reports its deployment mode in `BackendServerState`. Check this to conditionally adjust your UI:

```tsx
const { clientState } = useBodhi();
const deployment = clientState.server.deployment; // 'standalone' | 'multi_tenant' | null

if (deployment === 'multi_tenant') {
  // Show tenant selector, or use client_id from BackendServerState for routing
  const clientId = clientState.server.client_id;
}
```

## Multi-Tenant Deployment

Isolate storage and routing per tenant using `basePath`:

```tsx
<BodhiProvider authClientId="your-client-id" basePath="/tenant-a">
  <TenantApp />
</BodhiProvider>
```

Each `basePath` gets its own isolated storage (connection preferences, auth tokens). The OAuth callback URL is derived as `{origin}{basePath}/callback`.

### OAuth Redirect URI for GitHub Pages

Register the callback URL with the full base path:

```
https://yourusername.github.io/your-repo-name/callback
```

### GitHub Actions Workflow

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```
