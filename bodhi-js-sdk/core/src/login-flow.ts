/**
 * Shared consent-flow login orchestration.
 *
 * Every client variant runs the same recipe — noop guard, PKCE, scope, consent
 * URL, navigate — and differs only in the seams below (where the server URL and
 * redirect URI come from, where PKCE material is stored, and how navigation to
 * the consent page happens).
 */

import { createOperationError } from './errors';
import {
  buildConsentUrl,
  buildLoginScope,
  generateCodeChallenge,
  generateCodeVerifier,
  getAccessRequestId,
} from './oauth';
import type { AuthState, LoginOptions } from './types';

export interface ConsentLoginSeams {
  getAuthState(): Promise<AuthState>;
  /** Bodhi server URL the consent page lives on; throw an actionable BodhiError when unknown. */
  getServerUrl(): Promise<string>;
  getRedirectUri(): Promise<string> | string;
  storePkce(values: { codeVerifier: string; state: string }): Promise<void>;
  /**
   * Navigate the user to the consent page. Redirect clients (web) never resolve;
   * window/CLI clients resolve with the final AuthState after the callback.
   */
  navigate(consentUrl: string): Promise<AuthState>;
}

export async function performConsentLogin(
  seams: ConsentLoginSeams,
  clientId: string,
  options?: LoginOptions
): Promise<AuthState> {
  const existing = await seams.getAuthState();
  if (existing.status === 'authenticated' && !options?.reauthorize) {
    return existing;
  }

  // Reauthorize prefills the consent page from the current grant. When the claim
  // is missing (or the session expired) this degrades to a fresh consent request.
  let sourceAccessRequestId: string | undefined;
  if (options?.reauthorize && existing.status === 'authenticated' && existing.accessToken) {
    sourceAccessRequestId = getAccessRequestId(existing.accessToken);
  }

  if (!clientId) {
    throw createOperationError('auth_error', 'OAuth client ID is not configured');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateCodeVerifier();
  await seams.storePkce({ codeVerifier, state });

  const consentUrl = buildConsentUrl(await seams.getServerUrl(), {
    clientId,
    redirectUri: await seams.getRedirectUri(),
    scope: buildLoginScope(options),
    state,
    codeChallenge,
    sourceAccessRequestId,
  });

  options?.onProgress?.('reviewing');
  return seams.navigate(consentUrl);
}
