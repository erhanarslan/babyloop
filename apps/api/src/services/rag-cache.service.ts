import { createHash } from "node:crypto";
import type { AssistantIntent } from "./assistant-intent-router.service.js";
import type { RagSearchResult, RagAnswer } from "./rag.types.js";
import type { RagRedisClient } from "./rag-redis.service.js";

export type RagCacheBackend = "memory" | "redis" | "disabled";
export type RagCacheEffectiveBackend = "memory" | "redis" | "disabled";

export type RagCacheStats = {
  enabled: boolean;
  backend: RagCacheBackend;
  backendEffective: RagCacheEffectiveBackend;
  entries: number;
  hits: number;
  misses: number;
  sets: number;
  clears: number;
  hitRate: number;
};

type CachedAnswer = {
  kind: "answer";
  createdAt: string;
  value: RagAnswer;
};

type CachedSearch = {
  kind: "search";
  createdAt: string;
  value: RagSearchResult[];
};

type CacheEntry = {
  expiresAt: number;
  value: CachedAnswer | CachedSearch;
};

export class RagCacheService {
  private readonly backend: RagCacheBackend;
  private backendEffective: RagCacheEffectiveBackend;
  private readonly enabled: boolean;
  private readonly keyPrefix: string;
  private readonly maxEntries: number;
  private readonly redis: RagRedisClient | null;
  private readonly ttlSeconds: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private clears = 0;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(options: {
    backend: "memory" | "redis";
    enabled: boolean;
    keyPrefix: string;
    maxEntries: number;
    redis?: RagRedisClient | null;
    ttlSeconds: number;
  }) {
    this.backend = options.enabled ? options.backend : "disabled";
    this.backendEffective = this.backend === "redis" && options.redis ? "redis" : this.backend === "disabled" ? "disabled" : "memory";
    this.enabled = options.enabled;
    this.keyPrefix = options.keyPrefix;
    this.maxEntries = options.maxEntries;
    this.redis = options.redis ?? null;
    this.ttlSeconds = options.ttlSeconds;
    this.ttlMs = options.ttlSeconds * 1000;
  }

  buildKey(input: {
    intent: AssistantIntent | "search";
    kind?: "assistant" | "search";
    locale: string;
    message: string;
    model?: string;
    version?: string;
  }): string {
    const kind = input.kind ?? "assistant";
    const normalized = [
      kind,
      normalizeForCache(input.locale),
      normalizeForCache(input.intent),
      normalizeForCache(input.model ?? "default-model"),
      normalizeForCache(input.version ?? "v1"),
      normalizeForCache(input.message)
    ].join(":");

    return `${this.keyPrefix}:cache:${kind}:${hashForCache(normalized)}`;
  }

  async get(key: string): Promise<RagAnswer | null> {
    const cached = await this.getValue(key);

    if (cached?.kind !== "answer") {
      return null;
    }

    return {
      ...cached.value,
      cacheHit: true
    };
  }

  async set(key: string, value: RagAnswer): Promise<void> {
    await this.setValue(key, {
      kind: "answer",
      createdAt: new Date().toISOString(),
      value
    });
  }

  async getSearch(key: string): Promise<RagSearchResult[] | null> {
    const cached = await this.getValue(key);

    return cached?.kind === "search" ? cached.value : null;
  }

  async setSearch(key: string, value: RagSearchResult[]): Promise<void> {
    await this.setValue(key, {
      kind: "search",
      createdAt: new Date().toISOString(),
      value
    });
  }

  async clear(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.clears += 1;

    if (this.backendEffective === "redis" && this.redis) {
      try {
        const keys = await this.redis.scan(`${this.keyPrefix}:cache:*`);
        await this.redis.del(keys);
        await this.incrementRedisStat("clears");
        return;
      } catch {
        this.backendEffective = "memory";
      }
    }

    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async stats(): Promise<RagCacheStats> {
    const redisStats = this.backendEffective === "redis" && this.redis
      ? await this.readRedisStats()
      : null;
    const hits = redisStats?.hits ?? this.hits;
    const misses = redisStats?.misses ?? this.misses;
    const total = hits + misses;

    return {
      enabled: this.enabled,
      backend: this.backend,
      backendEffective: this.backendEffective,
      entries: redisStats?.entries ?? this.entries.size,
      hits,
      misses,
      sets: redisStats?.sets ?? this.sets,
      clears: redisStats?.clears ?? this.clears,
      hitRate: total === 0 ? 0 : Number((hits / total).toFixed(2))
    };
  }

  getBackendSummary(): { backend: RagCacheBackend; backendEffective: RagCacheEffectiveBackend; enabled: boolean } {
    return {
      backend: this.backend,
      backendEffective: this.backendEffective,
      enabled: this.enabled
    };
  }

  private async getValue(key: string): Promise<CachedAnswer | CachedSearch | null> {
    if (!this.enabled) {
      return null;
    }

    if (this.backendEffective === "redis" && this.redis) {
      try {
        const raw = await this.redis.get(key);
        await this.incrementRedisStat(raw ? "hits" : "misses");

        if (!raw) {
          return null;
        }

        return parseCachedValue(raw);
      } catch {
        this.backendEffective = "memory";
      }
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

  private async setValue(key: string, value: CachedAnswer | CachedSearch): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (this.backendEffective === "redis" && this.redis) {
      try {
        await this.redis.setJson(key, value, this.ttlSeconds);
        await this.incrementRedisStat("sets");
        return;
      } catch {
        this.backendEffective = "memory";
      }
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
    this.sets += 1;
  }

  private async incrementRedisStat(name: "hits" | "misses" | "sets" | "clears"): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.incr(`${this.keyPrefix}:cache:stats:${name}`);
    } catch {
      this.backendEffective = "memory";
    }
  }

  private async readRedisStats(): Promise<Pick<RagCacheStats, "entries" | "hits" | "misses" | "sets" | "clears"> | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const [answerKeys, searchKeys, hits, misses, sets, clears] = await Promise.all([
        this.redis.scan(`${this.keyPrefix}:cache:assistant:*`),
        this.redis.scan(`${this.keyPrefix}:cache:search:*`),
        this.redis.get(`${this.keyPrefix}:cache:stats:hits`),
        this.redis.get(`${this.keyPrefix}:cache:stats:misses`),
        this.redis.get(`${this.keyPrefix}:cache:stats:sets`),
        this.redis.get(`${this.keyPrefix}:cache:stats:clears`)
      ]);

      return {
        entries: answerKeys.length + searchKeys.length,
        hits: Number(hits ?? 0),
        misses: Number(misses ?? 0),
        sets: Number(sets ?? 0),
        clears: Number(clears ?? 0)
      };
    } catch {
      this.backendEffective = "memory";
      return null;
    }
  }
}

function parseCachedValue(raw: string): CachedAnswer | CachedSearch | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CachedAnswer | CachedSearch>;

    if (parsed.kind === "answer" || parsed.kind === "search") {
      return parsed as CachedAnswer | CachedSearch;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeForCache(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/\s+/gu, " ").slice(0, 400);
}

function hashForCache(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
