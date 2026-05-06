/**
 * Namespaced storage key generator
 *
 * Creates consistent storage keys with prefixes to avoid conflicts between
 * different connection modes and other applications.
 */

export interface StorageKeys {
  ACCESS_TOKEN: string;
  REFRESH_TOKEN: string;
  EXPIRES_AT: string;
  CODE_VERIFIER: string;
  STATE: string;
  ACCESS_REQUEST_ID: string;
}

/**
 * Create namespaced storage keys with a given prefix
 *
 * @param prefix - Namespace prefix (e.g., 'bodhi:direct', 'bodhi:web')
 * @returns Storage keys object with namespaced keys
 */
export function createStorageKeys(prefix: string): StorageKeys {
  return {
    ACCESS_TOKEN: `${prefix}:access_token`,
    REFRESH_TOKEN: `${prefix}:refresh_token`,
    EXPIRES_AT: `${prefix}:expires_at`,
    CODE_VERIFIER: `${prefix}:code_verifier`,
    STATE: `${prefix}:state`,
    ACCESS_REQUEST_ID: `${prefix}:access_request_id`,
  };
}

/**
 * Standard prefixes for different connection modes
 */
export const STORAGE_PREFIXES = {
  // Facade-level (BodhiClientUserPrefsManager user prefs)
  EXT: 'bodhi-js-sdk:ext:',
  WEB: 'bodhi-js-sdk:web:',
  // IConnectionClient-level (OAuth tokens)
  EXT_DIRECT: 'bodhi-js-sdk:ext:direct:',
  EXT_EXT: 'bodhi-js-sdk:ext:ext:',
  WEB_DIRECT: 'bodhi-js-sdk:web:direct:',
  WEB_EXT: 'bodhi-js-sdk:web:ext:',
} as const;

/**
 * Compose a storage prefix by joining a scope with an inner namespace segment.
 *
 * Generic namespace composer — used for any namespace dimension (basePath, serverUrl,
 * tenant, etc.). The first segment is appended with ':' and then the inner namespace
 * segment is appended as-is. Callers are responsible for ensuring the inner segment
 * ends with ':' if it is intended to be consumed as a `createStorageKeys` prefix.
 *
 * Examples:
 * - createStoragePrefixWithNamespace('/', 'bodhi:web:')         => '/:bodhi:web:'
 * - createStoragePrefixWithNamespace('/app1/', 'bodhi:web:')    => '/app1/:bodhi:web:'
 */
export function createStoragePrefixWithNamespace(scope: string, namespace: string): string {
  return `${scope}:${namespace}`;
}

/**
 * Extend a storage prefix with an encoded server URL segment for per-server isolation.
 *
 * Uses '::' as a unique boundary marker between the base namespace and the server URL
 * segment, so the URL segment is unambiguously parseable even when other segments contain
 * ':'. The URL is normalized (trailing slashes stripped, percent-encoded) so that ':' /
 * '/' inside the URL do not collide with the prefix separators.
 *
 * Example:
 * - createStoragePrefixWithServerUrl('/:bodhi-js-sdk:web:direct:', 'http://localhost:1135')
 *   => '/:bodhi-js-sdk:web:direct::http%3A%2F%2Flocalhost%3A1135:'
 *
 * @param basePrefix - Base prefix built with createStoragePrefixWithNamespace (ends with ':')
 * @param serverUrl  - Raw backend server URL (e.g., 'http://localhost:1135')
 */
export function createStoragePrefixWithServerUrl(basePrefix: string, serverUrl: string): string {
  const normalized = serverUrl.replace(/\/+$/, '');
  const encoded = encodeURIComponent(normalized);
  return `${basePrefix}:${encoded}:`;
}

/**
 * User Preferences Storage Manager
 *
 * Manages localStorage for user preferences including connection mode,
 * server URL, and other client configuration.
 *
 * Storage keys use configurable prefix to namespace all app storage.
 * Defaults to 'bodhijs:' for SDK usage.
 */

/**
 * Manager for reading/writing user preferences to localStorage
 */
export class BodhiClientUserPrefsManager {
  private readonly storagePrefix: string;
  private readonly STORAGE_KEYS: {
    DIRECT_STATUS: string;
    SERIALIZED_CLIENT_STATE: string;
  };
  private readonly SERVER_INSTALL_KEY: string;

  /**
   * @param storagePrefix - Prefix for localStorage keys
   */
  constructor(storagePrefix: string) {
    this.storagePrefix = storagePrefix;
    this.STORAGE_KEYS = {
      DIRECT_STATUS: `${storagePrefix}connection:directStatus`,
      SERIALIZED_CLIENT_STATE: `${storagePrefix}client:serializedState`,
    };
    this.SERVER_INSTALL_KEY = `${storagePrefix}server:installed`;
  }
  /**
   * Get direct connection status (LNA permission state)
   */
  getDirectStatus(): 'granted' | 'skipped' | 'denied' | null {
    return this.getStorageValue<'granted' | 'skipped' | 'denied' | null>(
      this.STORAGE_KEYS.DIRECT_STATUS,
      null
    );
  }

  /**
   * Set direct connection status (LNA permission state)
   */
  setDirectStatus(status: 'granted' | 'skipped' | 'denied' | null): void {
    this.setStorageValue(this.STORAGE_KEYS.DIRECT_STATUS, status);
  }

  /**
   * Clear all preferences
   */
  clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.DIRECT_STATUS);
      localStorage.removeItem(this.STORAGE_KEYS.SERIALIZED_CLIENT_STATE);
      localStorage.removeItem(this.SERVER_INSTALL_KEY);
    } catch (error) {
      console.warn('[BodhiClientUserPrefsManager] Failed to clear preferences:', error);
    }
  }

  /**
   * Check if server install was confirmed
   * (Separate from connection prefs - stored at server:installed key)
   */
  isServerInstallConfirmed(): boolean {
    return this.getStorageValue<boolean>(this.SERVER_INSTALL_KEY, false);
  }

  /**
   * Set server install confirmation
   */
  setServerInstallConfirmed(confirmed: boolean): void {
    this.setStorageValue(this.SERVER_INSTALL_KEY, confirmed);
  }

  /**
   * Get serialized client state
   */
  getSerializedClientState<T>(): T | null {
    return this.getStorageValue<T | null>(this.STORAGE_KEYS.SERIALIZED_CLIENT_STATE, null);
  }

  /**
   * Set serialized client state
   */
  setSerializedClientState<T>(state: T): void {
    this.setStorageValue(this.STORAGE_KEYS.SERIALIZED_CLIENT_STATE, state);
  }

  // Private helpers

  private getStorageValue<T>(key: string, defaultValue: T): T {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return defaultValue;
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`[BodhiClientUserPrefsManager] Failed to read ${key}:`, error);
      return defaultValue;
    }
  }

  private setStorageValue<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[BodhiClientUserPrefsManager] Failed to write ${key}:`, error);
      // localStorage unavailable (private browsing, quota exceeded)
      // silently fail - in-memory state still works
    }
  }
}
