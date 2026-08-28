/**
 * OAuth Utilities
 *
 * Shared OAuth utilities for PKCE, JWT, and endpoint construction.
 * Used by both sdk/web and sdk/ext for OAuth flows.
 */

import type { LoginOptions, UserInfo } from './types';

// ============================================================================
// PKCE (Proof Key for Code Exchange)
// ============================================================================

/**
 * Base64 URL encode a buffer (for PKCE)
 */
export function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

/**
 * Generate code challenge from verifier for PKCE
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

// ============================================================================
// JWT (JSON Web Token)
// ============================================================================

/**
 * Parse JWT token and return payload
 */
export function parseJwt(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

/**
 * Read the access_request_id claim from an access token (used for reauthorize).
 * Returns undefined when the token cannot be parsed or the claim is absent.
 */
export function getAccessRequestId(accessToken: string): string | undefined {
  try {
    const claims = parseJwt(accessToken);
    const id = claims['access_request_id'];
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract UserInfo from JWT token
 */
export function extractUserInfo(token: string): UserInfo {
  const claims = parseJwt(token) as Record<string, unknown>;
  return {
    sub: claims.sub as string,
    email: claims.email as string,
    name: claims.name as string,
    given_name: claims.given_name as string,
    family_name: claims.family_name as string,
    preferred_username: claims.preferred_username as string,
  };
}

// ============================================================================
// OAuth Endpoints
// ============================================================================

export interface OAuthEndpoints {
  authorize: string;
  token: string;
  revoke: string;
}

/**
 * Create OAuth endpoints from auth server URL
 */
export function createOAuthEndpoints(authServerUrl: string): OAuthEndpoints {
  return {
    authorize: `${authServerUrl}/protocol/openid-connect/auth`,
    token: `${authServerUrl}/protocol/openid-connect/token`,
    revoke: `${authServerUrl}/protocol/openid-connect/revoke`,
  };
}

// ============================================================================
// Consent flow: scope + URL construction
// ============================================================================

// BodhiApp guarantees these in the scope it composes for Keycloak, but the SDK keeps
// sending them: Keycloak requires openid, and BodhiApp dedupes passthrough tokens.
export const BASE_OAUTH_SCOPE = 'openid profile email roles';

/**
 * Compose the scope string for the consent-page navigation from LoginOptions.
 *
 * - role → scope_user_user / scope_user_power_user (absent → server defaults to user)
 * - llms/mcps: undefined → token omitted (server default: requested),
 *   true → scope_apps:llms / scope_apps:mcps, false → :false suffix (section suppressed)
 * - extraScopes are appended verbatim (passthrough to Keycloak), deduped preserving
 *   first occurrence
 */
export function buildLoginScope(
  options?: Pick<LoginOptions, 'role' | 'llms' | 'mcps' | 'extraScopes'>
): string {
  const tokens = BASE_OAUTH_SCOPE.split(' ');
  if (options?.role) tokens.push(options.role);
  if (options?.llms !== undefined) {
    tokens.push(options.llms ? 'scope_apps:llms' : 'scope_apps:llms:false');
  }
  if (options?.mcps !== undefined) {
    tokens.push(options.mcps ? 'scope_apps:mcps' : 'scope_apps:mcps:false');
  }
  if (options?.extraScopes) tokens.push(...options.extraScopes);
  return [...new Set(tokens.filter((t) => t.length > 0))].join(' ');
}

export interface ConsentUrlParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  sourceAccessRequestId?: string;
}

/**
 * Build the BodhiApp consent-page URL the app top-level-navigates to.
 * The trailing slash on /ui/apps/auth/ is required by the server route.
 */
export function buildConsentUrl(serverUrl: string, params: ConsentUrlParams): string {
  const base = serverUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/ui/apps/auth/`);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('scope', params.scope);
  if (params.sourceAccessRequestId) {
    url.searchParams.set('source_access_request_id', params.sourceAccessRequestId);
  }
  return url.toString();
}

// ============================================================================
// Token Refresh
// ============================================================================

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}

export type RefreshTokenResult =
  | { success: true; tokens: RefreshTokenResponse }
  | { success: false; error: 'invalid_grant' | 'network_error' | 'other_error' };

/**
 * Refresh access token using refresh token
 * @param tokenEndpoint - OAuth token endpoint URL
 * @param refreshToken - Current refresh token
 * @param clientId - OAuth client ID
 * @returns Result with tokens on success, or error type on failure
 */
export async function refreshAccessToken(
  tokenEndpoint: string,
  refreshToken: string,
  clientId: string
): Promise<RefreshTokenResult> {
  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.error === 'invalid_grant') {
          return { success: false, error: 'invalid_grant' };
        }
        return { success: false, error: 'other_error' };
      } catch {
        return { success: false, error: 'other_error' };
      }
    }

    const tokens = await response.json();
    return {
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        expires_in: tokens.expires_in || 3600,
      },
    };
  } catch {
    return { success: false, error: 'network_error' };
  }
}
