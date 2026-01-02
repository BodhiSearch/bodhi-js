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
// Token Refresh
// ============================================================================

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}

/**
 * Refresh access token using refresh token
 * @param tokenEndpoint - OAuth token endpoint URL
 * @param refreshToken - Current refresh token
 * @param clientId - OAuth client ID
 * @returns New tokens or null if refresh failed
 */
export async function refreshAccessToken(
  tokenEndpoint: string,
  refreshToken: string,
  clientId: string
): Promise<RefreshTokenResponse | null> {
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
      return null;
    }

    const tokens = await response.json();
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      expires_in: tokens.expires_in || 3600,
    };
  } catch {
    return null;
  }
}
