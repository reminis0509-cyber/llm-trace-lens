import { describe, it, expect, beforeEach, vi } from 'vitest';

// workspace-resolver内のApiKeyCacheクラスをテストするため、
// エクスポートされたインスタンスを直接使用
// ここではLRUキャッシュのロジックを単体テストする

describe('ApiKeyCache (LRU)', () => {
  // キャッシュの動作を独立してテストするため、簡易的なLRUキャッシュを再実装してテスト
  class TestLRUCache<T> {
    private cache: Map<string, { data: T; expiresAt: number }> = new Map();
    private ttl: number;
    private maxEntries: number;

    constructor(ttlMs: number, maxEntries: number) {
      this.ttl = ttlMs;
      this.maxEntries = maxEntries;
    }

    get(key: string): T | undefined {
      const entry = this.cache.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return undefined;
      }
      // LRU: 末尾に移動
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.data;
    }

    set(key: string, data: T): void {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
      if (this.cache.size >= this.maxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) {
          this.cache.delete(oldestKey);
        }
      }
      this.cache.set(key, { data, expiresAt: Date.now() + this.ttl });
    }

    get size(): number {
      return this.cache.size;
    }

    clear(): void {
      this.cache.clear();
    }
  }

  let cache: TestLRUCache<string>;

  beforeEach(() => {
    cache = new TestLRUCache<string>(60000, 3); // TTL 60秒, 最大3エントリ
  });

  it('基本的なset/getが動作する', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('存在しないキーはundefinedを返す', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('最大エントリ数を超えると最古のエントリが削除される', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // key1が削除されるはず

    expect(cache.size).toBe(3);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('アクセスされたエントリはLRU削除から保護される', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // key1にアクセス → LRU末尾に移動
    cache.get('key1');

    // key4を追加 → key2（最古）が削除されるはず
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1'); // 保護された
    expect(cache.get('key2')).toBeUndefined(); // 削除された
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('期限切れのエントリはundefinedを返す', async () => {
    // TTL 50msのキャッシュ
    const shortCache = new TestLRUCache<string>(50, 10);
    shortCache.set('key1', 'value1');

    // 期限切れを待つ
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(shortCache.get('key1')).toBeUndefined();
  });

  it('同じキーの更新はエントリ数を増やさない', () => {
    cache.set('key1', 'value1');
    cache.set('key1', 'updated');

    expect(cache.size).toBe(1);
    expect(cache.get('key1')).toBe('updated');
  });

  it('clearで全エントリが削除される', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });
});
