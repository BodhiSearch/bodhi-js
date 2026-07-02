import { describe, it, expect, vi } from 'vitest';
import { DirectClientBase } from './direct-client-base';
import { createStorageKeys, createStoragePrefixWithServerUrl } from './storage';
import { InMemoryStorage } from './types/storage';
import type { AuthState, StateChangeCallback, StateChange, LoginOptions } from './types';

/**
 * Concrete test subclass of DirectClientBase
 */
class TestDirectClient extends DirectClientBase {
  async login(_options?: LoginOptions): Promise<AuthState> {
    throw new Error('Not implemented in test');
  }

  protected _getRedirectUri(): string {
    return 'http://test/callback';
  }
}

function createClient(opts?: {
  initialTokens?: { accessToken: string; refreshToken?: string; expiresAt?: number };
  onStateChange?: StateChangeCallback;
}) {
  const storage = new InMemoryStorage();
  const client = new TestDirectClient(
    {
      authClientId: 'test-client',
      authServerUrl: 'https://auth.example.com',
      storagePrefix: 'test',
      logLevel: 'error',
      loggerPrefix: 'TestClient',
      storage,
      initialTokens: opts?.initialTokens,
    },
    opts?.onStateChange
  );
  return { client, storage };
}

// A valid JWT with sub, email, name, etc. (base64-encoded payload)
function createTestJwt(expiresInSeconds = 3600): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      preferred_username: 'testuser',
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

describe('DirectClientBase', () => {
  describe('Token Injection — valid token', () => {
    it('sets authenticated state when initialTokens has valid accessToken', async () => {
      const authChanges: AuthState[] = [];
      const accessToken = createTestJwt(3600);
      const expiresAt = Date.now() + 3600 * 1000;

      const { client } = createClient({
        initialTokens: { accessToken, refreshToken: 'refresh-123', expiresAt },
        onStateChange: (change: StateChange) => {
          if (change.type === 'auth-state') authChanges.push(change.state);
        },
      });

      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      expect(authChanges.length).toBeGreaterThanOrEqual(1);
      const authState = authChanges.find((s) => s.status === 'authenticated');
      expect(authState).toBeDefined();
      expect(authState!.accessToken).toBe(accessToken);
      expect(authState!.refreshToken).toBe('refresh-123');
      expect(authState!.expiresAt).toBe(expiresAt);
      expect(authState!.isTokenRefresh).toBe(false);
      expect(authState!.user?.email).toBe('test@example.com');
    });
  });

  describe('Token Injection — expired token without refresh', () => {
    it('sets unauthenticated state when token is expired and no refresh token', async () => {
      const authChanges: AuthState[] = [];
      const accessToken = createTestJwt(-10); // expired
      const expiresAt = Date.now() - 10000; // in the past

      const { client } = createClient({
        initialTokens: { accessToken, expiresAt },
        onStateChange: (change: StateChange) => {
          if (change.type === 'auth-state') authChanges.push(change.state);
        },
      });

      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      const unauthState = authChanges.find((s) => s.status === 'unauthenticated');
      expect(unauthState).toBeDefined();
      expect(unauthState!.isTokenRefresh).toBe(false);
    });
  });

  describe('Concrete logout()', () => {
    it('clears storage and sets unauthenticated state', async () => {
      const authChanges: AuthState[] = [];
      const accessToken = createTestJwt(3600);
      const expiresAt = Date.now() + 3600 * 1000;

      // Mock fetch for token revocation
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const { client, storage } = createClient({
        initialTokens: { accessToken, refreshToken: 'refresh-123', expiresAt },
        onStateChange: (change: StateChange) => {
          if (change.type === 'auth-state') authChanges.push(change.state);
        },
      });

      const serverUrl = 'http://localhost:1135';
      await client.init({
        serverUrl,
        selectedConnection: true,
        testConnection: false,
      });

      const keys = createStorageKeys(createStoragePrefixWithServerUrl('test', serverUrl));

      // Verify tokens are stored
      expect(await storage.get(keys.ACCESS_TOKEN)).toBe(accessToken);
      expect(await storage.get(keys.REFRESH_TOKEN)).toBe('refresh-123');

      const logoutResult = await client.logout();
      expect(logoutResult.status).toBe('unauthenticated');
      expect(logoutResult.refreshToken).toBeNull();
      expect(logoutResult.expiresAt).toBeNull();
      expect(logoutResult.isTokenRefresh).toBe(false);

      // Verify storage is cleared
      expect(await storage.get(keys.ACCESS_TOKEN)).toBeNull();
      expect(await storage.get(keys.REFRESH_TOKEN)).toBeNull();
      expect(await storage.get(keys.EXPIRES_AT)).toBeNull();

      // Verify revocation was attempted
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/revoke'),
        expect.objectContaining({ method: 'POST' })
      );

      globalThis.fetch = originalFetch;
    });
  });

  describe('getAuthState() with new fields', () => {
    it('returns refreshToken and expiresAt when authenticated', async () => {
      const accessToken = createTestJwt(3600);
      const expiresAt = Date.now() + 3600 * 1000;

      // Mock fetch to prevent actual network calls
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const { client } = createClient({
        initialTokens: { accessToken, refreshToken: 'refresh-xyz', expiresAt },
      });

      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      const state = await client.getAuthState();
      expect(state.status).toBe('authenticated');
      expect(state.refreshToken).toBe('refresh-xyz');
      expect(state.expiresAt).toBe(expiresAt);
      expect(state.isTokenRefresh).toBe(false);

      globalThis.fetch = originalFetch;
    });

    it('returns null fields when unauthenticated', async () => {
      const { client } = createClient();

      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      const state = await client.getAuthState();
      expect(state.status).toBe('unauthenticated');
      expect(state.refreshToken).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.isTokenRefresh).toBe(false);
    });
  });

  describe('Re-init does not overwrite refreshed tokens', () => {
    it('does not re-bootstrap initialTokens on second init', async () => {
      const authChanges: AuthState[] = [];
      const accessToken = createTestJwt(3600);
      const expiresAt = Date.now() + 3600 * 1000;

      const { client } = createClient({
        initialTokens: { accessToken, refreshToken: 'r1', expiresAt },
        onStateChange: (change: StateChange) => {
          if (change.type === 'auth-state') authChanges.push(change.state);
        },
      });

      // First init — should bootstrap tokens
      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      const firstAuthCount = authChanges.length;
      expect(firstAuthCount).toBeGreaterThanOrEqual(1);

      // Second init — should NOT re-bootstrap (initialTokens consumed)
      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      // No additional auth state changes from token bootstrap
      expect(authChanges.length).toBe(firstAuthCount);
    });
  });

  describe('Storage delegation', () => {
    it('throws when storage is not configured', async () => {
      const client = new TestDirectClient(
        {
          authClientId: 'test',
          authServerUrl: 'https://auth.example.com',
          storagePrefix: 'test',
          logLevel: 'error',
          loggerPrefix: 'Test',
          // No storage provided
        },
        undefined
      );

      // storageKeys are built on init(); call init first so getAuthState reaches
      // _storageGet and exercises the no-storage guard rather than short-circuiting
      // on the pre-init serverUrl check.
      await client.init({
        serverUrl: 'http://localhost:1135',
        selectedConnection: true,
        testConnection: false,
      });

      await expect(client.getAuthState()).rejects.toThrow('No storage adapter configured');
    });
  });

  describe('Server URL namespacing', () => {
    it('clears tokens from previous server on URL switch', async () => {
      const authChanges: AuthState[] = [];
      const accessToken = createTestJwt(3600);
      const expiresAt = Date.now() + 3600 * 1000;

      // Mock fetch for token revocation
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const { client, storage } = createClient({
        initialTokens: { accessToken, refreshToken: 'refresh-A', expiresAt },
        onStateChange: (change: StateChange) => {
          if (change.type === 'auth-state') authChanges.push(change.state);
        },
      });

      const serverA = 'http://localhost:1135';
      const serverB = 'http://localhost:2222';

      // Authenticate against server A
      await client.init({ serverUrl: serverA, selectedConnection: true, testConnection: false });
      const keysA = createStorageKeys(createStoragePrefixWithServerUrl('test', serverA));
      expect(await storage.get(keysA.ACCESS_TOKEN)).toBe(accessToken);
      expect((await client.getAuthState()).status).toBe('authenticated');

      // Switch to server B (no initial tokens for B)
      await client.init({ serverUrl: serverB, selectedConnection: true, testConnection: false });

      // Server A's tokens are purged for security
      expect(await storage.get(keysA.ACCESS_TOKEN)).toBeNull();
      expect(await storage.get(keysA.REFRESH_TOKEN)).toBeNull();
      expect(await storage.get(keysA.EXPIRES_AT)).toBeNull();

      // Client reports unauthenticated under the new server's namespace
      expect((await client.getAuthState()).status).toBe('unauthenticated');

      // Revocation was attempted against the previous server's refresh token
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/revoke'),
        expect.objectContaining({ method: 'POST' })
      );

      globalThis.fetch = originalFetch;
    });

    it('keeps tokens isolated between concurrent per-server namespaces', async () => {
      const { storage } = createClient();
      const serverA = 'http://a.example:1111';
      const serverB = 'http://b.example:2222';

      const keysA = createStorageKeys(createStoragePrefixWithServerUrl('test', serverA));
      const keysB = createStorageKeys(createStoragePrefixWithServerUrl('test', serverB));

      // Two distinct URLs must produce distinct ACCESS_TOKEN keys
      expect(keysA.ACCESS_TOKEN).not.toBe(keysB.ACCESS_TOKEN);

      // Writing to A's namespace must not be visible under B's namespace
      await storage.set({ [keysA.ACCESS_TOKEN]: 'token-for-A' });
      expect(await storage.get(keysA.ACCESS_TOKEN)).toBe('token-for-A');
      expect(await storage.get(keysB.ACCESS_TOKEN)).toBeNull();
    });
  });
});
