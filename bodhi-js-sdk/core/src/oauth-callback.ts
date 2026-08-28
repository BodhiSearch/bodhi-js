/**
 * OAuth callback parsing and classification — single source of truth for every
 * client variant (web redirect, chrome.identity, CLI http server, BodhiProvider).
 *
 * On approve, Keycloak redirects to the app's redirect_uri with code + state.
 * On deny or a redirectable request error, BodhiApp redirects with
 * error, error_description, error_source=bodhi, and the original state.
 */

import { createOperationError } from './errors';

export type OAuthCallbackParams =
  | { kind: 'code'; code: string; state: string | null }
  | {
      kind: 'error';
      error: string;
      errorDescription: string | null;
      errorSource: string | null;
      state: string | null;
    }
  | { kind: 'none' };

export function parseOAuthCallback(params: URLSearchParams): OAuthCallbackParams {
  const error = params.get('error');
  if (error) {
    return {
      kind: 'error',
      error,
      errorDescription: params.get('error_description'),
      errorSource: params.get('error_source'),
      state: params.get('state'),
    };
  }
  const code = params.get('code');
  if (code) {
    return { kind: 'code', code, state: params.get('state') };
  }
  return { kind: 'none' };
}

/**
 * Validate a callback and return the authorization code, throwing a BodhiError
 * with the SDK's public error codes otherwise:
 *
 * - Bodhi-sourced errors (error_source=bodhi) always echo the state the SDK sent,
 *   so state is required to match — a mismatch downgrades a deny to
 *   access_request_failed rather than trusting a forged callback.
 * - error=access_denied from bodhi → access_request_denied.
 * - Any other error → access_request_failed (message carries error + description).
 * - The code path requires a matching state (CSRF protection).
 */
export function assertCallbackSuccess(
  params: URLSearchParams,
  expectedState: string | null
): { code: string } {
  const parsed = parseOAuthCallback(params);

  if (parsed.kind === 'error') {
    if (parsed.errorSource === 'bodhi') {
      if (!parsed.state || parsed.state !== expectedState) {
        throw createOperationError('access_request_failed', 'state mismatch on error callback');
      }
      if (parsed.error === 'access_denied') {
        throw createOperationError(
          'access_request_denied',
          parsed.errorDescription ?? 'user denied the access request'
        );
      }
      throw createOperationError(
        'access_request_failed',
        `${parsed.error}: ${parsed.errorDescription ?? ''}`.trim()
      );
    }
    if (parsed.state && expectedState && parsed.state !== expectedState) {
      throw createOperationError('access_request_failed', 'state mismatch on error callback');
    }
    throw createOperationError(
      'access_request_failed',
      `${parsed.error}: ${parsed.errorDescription ?? ''}`.trim()
    );
  }

  if (parsed.kind === 'code') {
    if (!parsed.state || parsed.state !== expectedState) {
      throw createOperationError('auth_error', 'Invalid state parameter');
    }
    return { code: parsed.code };
  }

  throw createOperationError('access_request_failed', 'missing code/error in callback');
}
