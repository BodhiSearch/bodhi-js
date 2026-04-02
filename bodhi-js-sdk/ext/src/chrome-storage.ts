import type { IStorage } from '@bodhiapp/bodhi-js-core';

export class ChromeSessionStorageAdapter implements IStorage {
  async get(key: string): Promise<string | null> {
    const data = await chrome.storage.session.get(key);
    const value = data[key];
    return value !== undefined ? String(value) : null;
  }

  async set(items: Record<string, string | number>): Promise<void> {
    await chrome.storage.session.set(items);
  }

  async remove(keys: string[]): Promise<void> {
    await chrome.storage.session.remove(keys);
  }
}
