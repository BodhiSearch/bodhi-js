import { describe, it, expect } from 'vitest';
import { BodhiError } from '@bodhiapp/bodhi-browser-types';
import { LoginOptionsBuilder } from './login-options';
import { BASE_OAUTH_SCOPE, buildConsentUrl, buildLoginScope, getAccessRequestId } from './oauth';
import { assertCallbackSuccess, parseOAuthCallback } from './oauth-callback';

function base64Url(json: object): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(payload: object): string {
  return `${base64Url({ alg: 'none' })}.${base64Url(payload)}.sig`;
}

describe('buildLoginScope', () => {
  it('bare options produce exactly the base scope', () => {
    expect(buildLoginScope()).toBe(BASE_OAUTH_SCOPE);
    expect(buildLoginScope({})).toBe(BASE_OAUTH_SCOPE);
  });

  it('appends the role token', () => {
    expect(buildLoginScope({ role: 'scope_user_power_user' })).toBe(
      `${BASE_OAUTH_SCOPE} scope_user_power_user`
    );
  });

  it('maps llms/mcps tri-state to scope tokens', () => {
    expect(buildLoginScope({ llms: true })).toBe(`${BASE_OAUTH_SCOPE} scope_apps:llms`);
    expect(buildLoginScope({ llms: false })).toBe(`${BASE_OAUTH_SCOPE} scope_apps:llms:false`);
    expect(buildLoginScope({ mcps: true })).toBe(`${BASE_OAUTH_SCOPE} scope_apps:mcps`);
    expect(buildLoginScope({ mcps: false })).toBe(`${BASE_OAUTH_SCOPE} scope_apps:mcps:false`);
    expect(buildLoginScope({ llms: undefined, mcps: undefined })).toBe(BASE_OAUTH_SCOPE);
  });

  it('supports the role-only request (both sections suppressed)', () => {
    expect(buildLoginScope({ role: 'scope_user_user', llms: false, mcps: false })).toBe(
      `${BASE_OAUTH_SCOPE} scope_user_user scope_apps:llms:false scope_apps:mcps:false`
    );
  });

  it('appends extraScopes verbatim and dedupes against the base scope', () => {
    expect(buildLoginScope({ extraScopes: ['custom_scope', 'openid', 'custom_scope'] })).toBe(
      `${BASE_OAUTH_SCOPE} custom_scope`
    );
  });
});

describe('buildConsentUrl', () => {
  const params = {
    clientId: 'app-123',
    redirectUri: 'http://localhost:6173/callback',
    scope: 'openid profile',
    state: 'st4te',
    codeChallenge: 'ch4llenge',
  };

  it('targets /ui/apps/auth/ with a trailing slash and normalizes the server URL', () => {
    const url = new URL(buildConsentUrl('http://localhost:1135/', params));
    expect(url.origin).toBe('http://localhost:1135');
    expect(url.pathname).toBe('/ui/apps/auth/');
  });

  it('sets all standard OAuth params', () => {
    const url = new URL(buildConsentUrl('http://localhost:1135', params));
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:6173/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('st4te');
    expect(url.searchParams.get('code_challenge')).toBe('ch4llenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid profile');
    expect(url.searchParams.has('source_access_request_id')).toBe(false);
  });

  it('includes source_access_request_id only when provided', () => {
    const url = new URL(
      buildConsentUrl('http://localhost:1135', { ...params, sourceAccessRequestId: 'req-1' })
    );
    expect(url.searchParams.get('source_access_request_id')).toBe('req-1');
  });
});

describe('parseOAuthCallback', () => {
  it('classifies code, error, and empty callbacks', () => {
    expect(parseOAuthCallback(new URLSearchParams('code=abc&state=s'))).toEqual({
      kind: 'code',
      code: 'abc',
      state: 's',
    });
    expect(
      parseOAuthCallback(new URLSearchParams('error=access_denied&error_source=bodhi&state=s'))
    ).toMatchObject({ kind: 'error', error: 'access_denied', errorSource: 'bodhi', state: 's' });
    expect(parseOAuthCallback(new URLSearchParams(''))).toEqual({ kind: 'none' });
  });
});

describe('assertCallbackSuccess', () => {
  const denyParams = (state: string) =>
    new URLSearchParams(
      `error=access_denied&error_description=user denied the access request&error_source=bodhi&state=${state}`
    );

  it('returns the code on a valid success callback', () => {
    expect(assertCallbackSuccess(new URLSearchParams('code=abc&state=s'), 's')).toEqual({
      code: 'abc',
    });
  });

  it('throws access_request_denied on a bodhi deny with matching state', () => {
    expect(() => assertCallbackSuccess(denyParams('s'), 's')).toThrowError(
      expect.objectContaining({ code: 'access_request_denied' })
    );
  });

  it('downgrades a bodhi deny with mismatched or absent state to access_request_failed', () => {
    expect(() => assertCallbackSuccess(denyParams('other'), 's')).toThrowError(
      expect.objectContaining({ code: 'access_request_failed' })
    );
    const noState = new URLSearchParams('error=access_denied&error_source=bodhi');
    expect(() => assertCallbackSuccess(noState, 's')).toThrowError(
      expect.objectContaining({ code: 'access_request_failed' })
    );
  });

  it('maps other bodhi errors to access_request_failed carrying the description', () => {
    const params = new URLSearchParams(
      "error=invalid_scope&error_description=Unrecognized scope token 'x'.&error_source=bodhi&state=s"
    );
    let thrown: unknown;
    try {
      assertCallbackSuccess(params, 's');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BodhiError);
    expect((thrown as BodhiError).code).toBe('access_request_failed');
    expect((thrown as BodhiError).message).toContain('invalid_scope');
    expect((thrown as BodhiError).message).toContain('Unrecognized scope token');
  });

  it('maps non-bodhi errors to access_request_failed', () => {
    const params = new URLSearchParams('error=server_error&error_description=oops');
    expect(() => assertCallbackSuccess(params, 's')).toThrowError(
      expect.objectContaining({ code: 'access_request_failed' })
    );
  });

  it('rejects a code callback with mismatched state', () => {
    expect(() =>
      assertCallbackSuccess(new URLSearchParams('code=abc&state=other'), 's')
    ).toThrowError(expect.objectContaining({ code: 'auth_error' }));
  });

  it('rejects a callback with neither code nor error', () => {
    expect(() => assertCallbackSuccess(new URLSearchParams(''), 's')).toThrowError(
      expect.objectContaining({ code: 'access_request_failed' })
    );
  });
});

describe('getAccessRequestId', () => {
  it('reads the access_request_id claim', () => {
    expect(getAccessRequestId(makeJwt({ access_request_id: 'req-42' }))).toBe('req-42');
  });

  it('returns undefined when the claim is missing or the token is malformed', () => {
    expect(getAccessRequestId(makeJwt({ sub: 'user' }))).toBeUndefined();
    expect(getAccessRequestId('not-a-jwt')).toBeUndefined();
  });
});

describe('LoginOptionsBuilder', () => {
  it('builds empty options by default', () => {
    expect(new LoginOptionsBuilder().build()).toEqual({});
  });

  it('composes role, section flags, reauthorize, and extra scopes', () => {
    const opts = new LoginOptionsBuilder()
      .setRole('scope_user_power_user')
      .setLlms()
      .setMcps(false)
      .setReauthorize()
      .addExtraScope('custom_scope')
      .build();
    expect(opts).toEqual({
      role: 'scope_user_power_user',
      llms: true,
      mcps: false,
      reauthorize: true,
      extraScopes: ['custom_scope'],
    });
  });

  it('setExtraScopes replaces the accumulated list', () => {
    const opts = new LoginOptionsBuilder().addExtraScope('a').setExtraScopes(['b', 'c']).build();
    expect(opts.extraScopes).toEqual(['b', 'c']);
  });
});
