import { describe, expect, it } from "vitest";
import { RagCacheService } from "../src/services/rag-cache.service.js";
import type { RagRedisClient } from "../src/services/rag-redis.service.js";

describe("rag cache service", () => {
  it("stores answers and records hit/miss stats", async () => {
    const cache = new RagCacheService({
      backend: "memory",
      enabled: true,
      keyPrefix: "test:rag",
      maxEntries: 2,
      ttlSeconds: 60
    });
    const key = cache.buildKey({
      intent: "rag_knowledge",
      locale: "tr",
      message: "Bebek arabası"
    });

    expect(await cache.get(key)).toBeNull();
    await cache.set(key, {
      answer: "Yanıt",
      sources: [],
      mode: "no_sources",
      grounded: false
    });

    expect((await cache.get(key))?.answer).toBe("Yanıt");
    expect(await cache.stats()).toMatchObject({
      enabled: true,
      backend: "memory",
      backendEffective: "memory",
      entries: 1,
      hits: 1,
      misses: 1,
      hitRate: 0.5
    });
  });

  it("does not store entries when disabled", async () => {
    const cache = new RagCacheService({
      backend: "memory",
      enabled: false,
      keyPrefix: "test:rag",
      maxEntries: 2,
      ttlSeconds: 60
    });

    await cache.set("x", {
      answer: "Yanıt",
      sources: [],
      mode: "no_sources",
      grounded: false
    });

    expect(await cache.get("x")).toBeNull();
    expect((await cache.stats()).entries).toBe(0);
  });

  it("stores search results separately from answers", async () => {
    const cache = new RagCacheService({
      backend: "memory",
      enabled: true,
      keyPrefix: "test:rag",
      maxEntries: 2,
      ttlSeconds: 60
    });
    const key = cache.buildKey({
      kind: "search",
      intent: "search",
      locale: "tr",
      message: "bebek arabası"
    });

    await cache.setSearch(key, [
      {
        score: 0.9,
        text: "Kaynak",
        citation: {
          title: "Kaynak",
          sourcePath: "docs/rag/test.md"
        }
      }
    ]);

    expect(await cache.getSearch(key)).toHaveLength(1);
  });

  it("falls back to memory when redis operations fail", async () => {
    const redis = {
      async get() {
        throw new Error("redis unavailable");
      },
      async setJson() {
        throw new Error("redis unavailable");
      }
    } as unknown as RagRedisClient;
    const cache = new RagCacheService({
      backend: "redis",
      enabled: true,
      keyPrefix: "test:rag",
      maxEntries: 2,
      redis,
      ttlSeconds: 60
    });
    const key = cache.buildKey({
      intent: "rag_knowledge",
      locale: "tr",
      message: "Redis fallback"
    });

    expect(await cache.get(key)).toBeNull();
    await cache.set(key, {
      answer: "Fallback yanıtı",
      sources: [],
      mode: "no_sources",
      grounded: false
    });

    expect((await cache.stats()).backendEffective).toBe("memory");
  });
});
