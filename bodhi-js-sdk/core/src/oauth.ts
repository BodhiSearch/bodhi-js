/**
 * OAuth Utilities
 *
 * Shared OAuth utilities for PKCE, JWT, and endpoint construction.
 * Used by both sdk/web and sdk/ext for OAuth flows.
 */

import type { UserInfo } from './types';

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
// Single-step access-request authorize URL
// ============================================================================

// Excludes the dynamic scope_access_request:<id>, which the Bodhi review screen appends on approval
// — state must not depend on the requested resource scopes.
export const BASE_OAUTH_SCOPE = 'openid profile email roles';

// Marks a callback as a Bodhi deny/failure redirect (vs a Keycloak success/error) via ?bodhi_flow=.
export const ACCESS_REQUEST_ERROR_MARKER = 'access_request_error';

// Must match the server's auth_endpoint (origin+path) and carry the params the review page validates.
export function buildAuthorizeUrl(
  endpoints: OAuthEndpoints,
  params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    codeChallenge: string;
  }
): string {
  const url = new URL(endpoints.authorize);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

export function buildReviewUrl(reviewUrl: string, authUrl: string, errorUrl: string): string {
  const url = new URL(reviewUrl);
  url.searchParams.set('auth_url', authUrl);
  url.searchParams.set('error_url', errorUrl);
  return url.toString();
}

export function buildErrorUrl(redirectUri: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set('bodhi_flow', ACCESS_REQUEST_ERROR_MARKER);
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
