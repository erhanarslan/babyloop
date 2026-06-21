import type { AssistantIntent } from "./assistant-intent-router.service.js";
import type { RagRedisClient } from "./rag-redis.service.js";
import type { RagAnswer, RagCitation } from "./rag.types.js";

export type RagMetricsBackend = "memory" | "redis" | "disabled";
export type RagMetricsEffectiveBackend = "memory" | "redis" | "disabled";

export type RagMetricsSnapshot = {
  enabled: boolean;
  backend: RagMetricsBackend;
  backendEffective: RagMetricsEffectiveBackend;
  date: string;
  counters: Record<string, number>;
  byIntent: Record<string, number>;
  byMode: Record<string, number>;
  byTopic: Record<string, number>;
};

export class RagMetricsService {
  private readonly backend: RagMetricsBackend;
  private backendEffective: RagMetricsEffectiveBackend;
  private readonly enabled: boolean;
  private readonly keyPrefix: string;
  private readonly redis: RagRedisClient | null;
  private readonly counters = new Map<string, number>();

  constructor(options: {
    backend: "memory" | "redis";
    enabled: boolean;
    keyPrefix: string;
    redis?: RagRedisClient | null;
  }) {
    this.backend = options.enabled ? options.backend : "disabled";
    this.backendEffective = this.backend === "redis" && options.redis ? "redis" : this.backend === "disabled" ? "disabled" : "memory";
    this.enabled = options.enabled;
    this.keyPrefix = options.keyPrefix;
    this.redis = options.redis ?? null;
  }

  async recordRequest(kind: "assistant" | "search"): Promise<void> {
    await this.increment("totalRequests");
    await this.increment(kind === "assistant" ? "assistantRequests" : "searchRequests");
  }

  async recordAnswer(answer: Pick<RagAnswer, "mode" | "intent" | "sources" | "toolsUsed" | "cacheHit">): Promise<void> {
    if (answer.mode === "rag") {
      await this.increment("ragResponses");
    } else if (answer.mode === "boundary") {
      await this.increment("boundaryResponses");
    } else {
      await this.increment("noSourceResponses");
    }

    if (answer.cacheHit) {
      await this.increment("cacheHits");
    }

    if (answer.toolsUsed?.includes("listing_search")) {
      await this.increment("listingToolResponses");
    }

    if (answer.intent) {
      await this.incrementScoped("intent", answer.intent);
    }

    await this.incrementScoped("mode", answer.mode);
    await this.recordTopics(answer.sources);
  }

  async recordSearchResult(input: { cacheHit: boolean; sources: RagCitation[] }): Promise<void> {
    if (input.cacheHit) {
      await this.increment("cacheHits");
    } else {
      await this.increment("cacheMisses");
    }

    await this.recordTopics(input.sources);
  }

  async recordCacheMiss(): Promise<void> {
    await this.increment("cacheMisses");
  }

  async recordRateLimited(): Promise<void> {
    await this.increment("rateLimitedRequests");
  }

  async recordEval(mode: "mock" | "live", blocked = false): Promise<void> {
    if (mode === "mock") {
      await this.increment("evalMockRuns");
      return;
    }

    await this.increment(blocked ? "liveEvalBlocked" : "liveEvalRuns");
  }

  async recordError(): Promise<void> {
    await this.increment("errors");
  }

  async snapshot(date = todayBucket()): Promise<RagMetricsSnapshot> {
    const keys = [
      "totalRequests",
      "assistantRequests",
      "searchRequests",
      "boundaryResponses",
      "ragResponses",
      "noSourceResponses",
      "listingToolResponses",
      "cacheHits",
      "cacheMisses",
      "rateLimitedRequests",
      "liveEvalRuns",
      "liveEvalBlocked",
      "evalMockRuns",
      "errors"
    ];

    return {
      enabled: this.enabled,
      backend: this.backend,
      backendEffective: this.backendEffective,
      date,
      counters: await this.readCounters(keys, date),
      byIntent: await this.readScoped("intent", date),
      byMode: await this.readScoped("mode", date),
      byTopic: await this.readScoped("topic", date)
    };
  }

  getBackendSummary(): { backend: RagMetricsBackend; backendEffective: RagMetricsEffectiveBackend; enabled: boolean } {
    return {
      backend: this.backend,
      backendEffective: this.backendEffective,
      enabled: this.enabled
    };
  }

  private async recordTopics(sources: RagCitation[]): Promise<void> {
    const topics = new Set(sources.map((source) => source.topic).filter((topic): topic is string => Boolean(topic)));

    for (const topic of topics) {
      await this.incrementScoped("topic", topic);
    }
  }

  private async incrementScoped(scope: "intent" | "mode" | "topic", value: AssistantIntent | string): Promise<void> {
    await this.increment(`${scope}:${value}`);
  }

  private async increment(name: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const key = this.metricKey(name);

    if (this.backendEffective === "redis" && this.redis) {
      try {
        await this.redis.incr(key);
        return;
      } catch {
        this.backendEffective = "memory";
      }
    }

    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  private async readCounters(names: string[], date: string): Promise<Record<string, number>> {
    const entries: Array<[string, number]> = [];

    for (const name of names) {
      entries.push([name, await this.readCounter(name, date)]);
    }

    return Object.fromEntries(entries);
  }

  private async readScoped(scope: "intent" | "mode" | "topic", date: string): Promise<Record<string, number>> {
    if (this.backendEffective === "redis" && this.redis) {
      try {
        const redis = this.redis;

        if (!redis) {
          return {};
        }

        const prefix = `${this.keyPrefix}:metrics:${date}:${scope}:`;
        const keys = await redis.scan(`${prefix}*`);
        const entries = await Promise.all(keys.map(async (key) => {
          const value = await redis.get(key);
          return [key.slice(prefix.length), Number(value ?? 0)] as const;
        }));

        return Object.fromEntries(entries);
      } catch {
        this.backendEffective = "memory";
      }
    }

    const prefix = `${this.keyPrefix}:metrics:${date}:${scope}:`;
    const entries = [...this.counters.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]);

    return Object.fromEntries(entries);
  }

  private async readCounter(name: string, date: string): Promise<number> {
    if (this.backendEffective === "redis" && this.redis) {
      try {
        return Number(await this.redis.get(this.metricKey(name, date)) ?? 0);
      } catch {
        this.backendEffective = "memory";
      }
    }

    return this.counters.get(this.metricKey(name, date)) ?? 0;
  }

  private metricKey(name: string, date = todayBucket()): string {
    return `${this.keyPrefix}:metrics:${date}:${name}`;
  }
}

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}
