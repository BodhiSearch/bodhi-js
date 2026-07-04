import { describe, it, expect, vi, afterEach } from 'vitest';
import { DirectClient } from './direct-client';

// A valid JWT with a future expiry (base64-encoded payload)
function createTestJwt(expiresInSeconds = 3600): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.test-signature`;
}

function createClient(serverUrl?: string) {
  return new DirectClient({
    authClientId: 'test-client',
    authServerUrl: 'https://auth.example.com',
    serverUrl,
    logLevel: 'error',
    initialTokens: {
      accessToken: createTestJwt(3600),
      refreshToken: 'refresh-123',
      expiresAt: Date.now() + 3600_000,
    },
  });
}

describe('DirectClient (headless)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('binds server + authenticates from injected tokens without interactive login', async () => {
    const client = createClient();
    await client.init({
      serverUrl: 'http://localhost:1135',
      selectedConnection: true,
      testConnection: false,
    });

    const auth = await client.getAuthState();
    expect(auth.status).toBe('authenticated');
    expect(auth.accessToken).toBeTruthy();
    expect(auth.user?.email).toBe('test@example.com');
  });

  it('rejects login() as unavailable in a headless context', async () => {
    const client = createClient();
    await expect(client.login()).rejects.toThrow(/headless\/worker context/);
  });

  it('builds a direct-mode MCP transport that injects a Bearer token', async () => {
    // Bind serverUrl via init() (not the constructor) so initialTokens are bootstrapped.
    const client = createClient();
    await client.init({
      serverUrl: 'http://localhost:1135',
      selectedConnection: true,
      testConnection: false,
    });
    expect((await client.getAuthState()).accessToken).toBeTruthy();

    const cfg = client.createMcpTransportConfig('/bodhi/v1/apps/mcps/abc/mcp');
    expect(cfg.url.toString()).toBe('http://localhost:1135/bodhi/v1/apps/mcps/abc/mcp');

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await cfg.fetch(cfg.url, { method: 'POST' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const headers = new Headers((fetchSpy.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('authorization')).toMatch(/^Bearer .+/);
  });

  it('throws when creating an MCP transport before the server is bound', () => {
    const client = createClient(); // no serverUrl, no init
    expect(() => client.createMcpTransportConfig('/x')).toThrow(/not initialized/);
  });
});
