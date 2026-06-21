import type { AssistantIntent } from "./assistant-intent-router.service.js";
import type { RagAnswer } from "./rag.types.js";

export type RagCacheStats = {
  enabled: boolean;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
};

type CacheEntry = {
  expiresAt: number;
  value: RagAnswer;
};

export class RagCacheService {
  private readonly enabled: boolean;
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(options: { enabled: boolean; maxEntries: number; ttlSeconds: number }) {
    this.enabled = options.enabled;
    this.maxEntries = options.maxEntries;
    this.ttlMs = options.ttlSeconds * 1000;
  }

  buildKey(input: { intent: AssistantIntent; message: string; locale: string }): string {
    return [
      normalizeForCache(input.locale),
      normalizeForCache(input.intent),
      normalizeForCache(input.message)
    ].join(":");
  }

  get(key: string): RagAnswer | null {
    if (!this.enabled) {
      return null;
    }

    const entry = this.entries.get(key);

    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        this.entries.delete(key);
      }

      this.misses += 1;
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: RagAnswer): void {
    if (!this.enabled) {
      return;
    }

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;

      if (!oldestKey) {
        break;
      }

      this.entries.delete(oldestKey);
    }

    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value
    });
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): RagCacheStats {
    const total = this.hits + this.misses;

    return {
      enabled: this.enabled,
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(2))
    };
  }
}

function normalizeForCache(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/\s+/gu, " ").slice(0, 400);
}
