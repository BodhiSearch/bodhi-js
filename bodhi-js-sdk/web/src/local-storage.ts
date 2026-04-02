import type { IStorage } from '@bodhiapp/bodhi-js-core';

export class LocalStorageAdapter implements IStorage {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async set(items: Record<string, string | number>): Promise<void> {
    Object.entries(items).forEach(([key, value]) => {
      localStorage.setItem(key, String(value));
    });
  }

  async remove(keys: string[]): Promise<void> {
    keys.forEach((key) => localStorage.removeItem(key));
  }
}
