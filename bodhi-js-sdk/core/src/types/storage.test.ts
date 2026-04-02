import { describe, it, expect } from 'vitest';
import { InMemoryStorage } from './storage';

describe('InMemoryStorage', () => {
  it('returns null for non-existent key', async () => {
    const storage = new InMemoryStorage();
    expect(await storage.get('missing')).toBeNull();
  });

  it('stores and retrieves string values', async () => {
    const storage = new InMemoryStorage();
    await storage.set({ key1: 'value1', key2: 'value2' });
    expect(await storage.get('key1')).toBe('value1');
    expect(await storage.get('key2')).toBe('value2');
  });

  it('converts numbers to strings', async () => {
    const storage = new InMemoryStorage();
    await storage.set({ expires: 1711843200000 });
    expect(await storage.get('expires')).toBe('1711843200000');
  });

  it('removes keys', async () => {
    const storage = new InMemoryStorage();
    await storage.set({ a: '1', b: '2', c: '3' });
    await storage.remove(['a', 'c']);
    expect(await storage.get('a')).toBeNull();
    expect(await storage.get('b')).toBe('2');
    expect(await storage.get('c')).toBeNull();
  });

  it('remove is no-op for non-existent keys', async () => {
    const storage = new InMemoryStorage();
    await storage.remove(['nonexistent']);
    expect(await storage.get('nonexistent')).toBeNull();
  });

  it('overwrites existing values', async () => {
    const storage = new InMemoryStorage();
    await storage.set({ key: 'old' });
    await storage.set({ key: 'new' });
    expect(await storage.get('key')).toBe('new');
  });
});
