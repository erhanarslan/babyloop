import { describe, expect, it } from "vitest";
import { RagCacheService } from "../src/services/rag-cache.service.js";

describe("rag cache service", () => {
  it("stores answers and records hit/miss stats", () => {
    const cache = new RagCacheService({
      enabled: true,
      maxEntries: 2,
      ttlSeconds: 60
    });
    const key = cache.buildKey({
      intent: "rag_knowledge",
      locale: "tr",
      message: "Bebek arabası"
    });

    expect(cache.get(key)).toBeNull();
    cache.set(key, {
      answer: "Yanıt",
      sources: [],
      mode: "no_sources",
      grounded: false
    });

    expect(cache.get(key)?.answer).toBe("Yanıt");
    expect(cache.stats()).toMatchObject({
      enabled: true,
      entries: 1,
      hits: 1,
      misses: 1,
      hitRate: 0.5
    });
  });

  it("does not store entries when disabled", () => {
    const cache = new RagCacheService({
      enabled: false,
      maxEntries: 2,
      ttlSeconds: 60
    });

    cache.set("x", {
      answer: "Yanıt",
      sources: [],
      mode: "no_sources",
      grounded: false
    });

    expect(cache.get("x")).toBeNull();
    expect(cache.stats().entries).toBe(0);
  });
});
