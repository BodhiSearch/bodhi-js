/**
 * Pluggable storage interface and implementations for token persistence
 */

/**
 * Storage adapter interface for token persistence.
 * Implementations: LocalStorageAdapter (web), ChromeSessionStorageAdapter (ext), InMemoryStorage (CLI/headless)
 */
export interface IStorage {
  get(key: string): Promise<string | null>;
  set(items: Record<string, string | number>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

/**
 * In-memory storage adapter for CLI/headless use cases.
 * Tokens live only in process memory — use onStateChange callback for external persistence.
 */
export class InMemoryStorage implements IStorage {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(items: Record<string, string | number>): Promise<void> {
    Object.entries(items).forEach(([key, value]) => {
      this.store.set(key, String(value));
    });
  }

  async remove(keys: string[]): Promise<void> {
    keys.forEach((key) => this.store.delete(key));
  }
}

/**
 * Pre-existing tokens for injection during client initialization.
 * Used by CLI/headless hosts that obtain OAuth tokens independently.
 */
export interface InitialTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp in milliseconds
}
