import { createHash } from "node:crypto";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { RagRedisClient } from "./rag-redis.service.js";

export type RagUsageBackend = "memory" | "redis" | "disabled";
export type RagUsageEffectiveBackend = "memory" | "redis" | "disabled";

export type RagUsageLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  retryAfterSeconds?: number;
};

export type RagUsageSummary = {
  enabled: boolean;
  backend: RagUsageBackend;
  backendEffective: RagUsageEffectiveBackend;
  limits: {
    hourlyGuest: number;
    dailyGuest: number;
    hourlyUser: number;
    dailyUser: number;
    adminBypass: boolean;
  };
};

type UsageEntry = {
  count: number;
  resetAt: number;
};

export class RagUsageLimitService {
  private readonly adminBypass: boolean;
  private readonly backend: RagUsageBackend;
  private backendEffective: RagUsageEffectiveBackend;
  private readonly dailyGuestLimit: number;
  private readonly dailyUserLimit: number;
  private readonly enabled: boolean;
  private readonly hourlyGuestLimit: number;
  private readonly hourlyUserLimit: number;
  private readonly keyPrefix: string;
  private readonly redis: RagRedisClient | null;
  private readonly entries = new Map<string, UsageEntry>();

  constructor(options: {
    adminBypass: boolean;
    backend: "memory" | "redis";
    dailyGuestLimit: number;
    dailyUserLimit: number;
    enabled: boolean;
    hourlyGuestLimit: number;
    hourlyUserLimit: number;
    keyPrefix: string;
    redis?: RagRedisClient | null;
  }) {
    this.adminBypass = options.adminBypass;
    this.backend = options.enabled ? options.backend : "disabled";
    this.backendEffective = this.backend === "redis" && options.redis ? "redis" : this.backend === "disabled" ? "disabled" : "memory";
    this.dailyGuestLimit = options.dailyGuestLimit;
    this.dailyUserLimit = options.dailyUserLimit;
    this.enabled = options.enabled;
    this.hourlyGuestLimit = options.hourlyGuestLimit;
    this.hourlyUserLimit = options.hourlyUserLimit;
    this.keyPrefix = options.keyPrefix;
    this.redis = options.redis ?? null;
  }

  async consume(input: {
    authenticated: boolean;
    currentUser?: CurrentUser | null;
    identifier: string;
    scope: "assistant" | "rag_search" | "live_eval";
  }): Promise<RagUsageLimitDecision> {
    if (!this.enabled) {
      return unlimitedDecision();
    }

    if (this.adminBypass && input.currentUser && input.currentUser.role.toLowerCase() === "admin") {
      return unlimitedDecision();
    }

    const identity = input.authenticated && input.currentUser
      ? `user:${input.currentUser.userId}`
      : `guest:${hashIdentifier(input.identifier)}`;
    const hourlyLimit = input.authenticated ? this.hourlyUserLimit : this.hourlyGuestLimit;
    const dailyLimit = input.authenticated ? this.dailyUserLimit : this.dailyGuestLimit;
    const now = Date.now();
    const hourlyKey = `${this.keyPrefix}:usage:${input.scope}:${identity}:hour:${hourBucket(now)}`;
    const dailyKey = `${this.keyPrefix}:usage:${input.scope}:${identity}:day:${dayBucket(now)}`;

    const hourlyDecision = await this.consumeWindow(hourlyKey, hourlyLimit, nextHourReset(now));

    if (!hourlyDecision.allowed) {
      return hourlyDecision;
    }

    return this.consumeWindow(dailyKey, dailyLimit, nextDailyReset(now));
  }

  summary(): RagUsageSummary {
    return {
      enabled: this.enabled,
      backend: this.backend,
      backendEffective: this.backendEffective,
      limits: {
        hourlyGuest: this.hourlyGuestLimit,
        dailyGuest: this.dailyGuestLimit,
        hourlyUser: this.hourlyUserLimit,
        dailyUser: this.dailyUserLimit,
        adminBypass: this.adminBypass
      }
    };
  }

  private async consumeWindow(key: string, limit: number, resetAt: number): Promise<RagUsageLimitDecision> {
    if (this.backendEffective === "redis" && this.redis) {
      try {
        const count = await this.redis.incr(key);

        if (count === 1) {
          await this.redis.expire(key, Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1));
        }

        return decisionFromCount(count, limit, resetAt);
      } catch {
        this.backendEffective = "memory";
      }
    }

    const existing = this.entries.get(key);
    const entry = existing && existing.resetAt > Date.now()
      ? existing
      : { count: 0, resetAt };

    entry.count += 1;
    this.entries.set(key, entry);

    return decisionFromCount(entry.count, limit, resetAt);
  }
}

function decisionFromCount(count: number, limit: number, resetAt: number): RagUsageLimitDecision {
  if (count > limit) {
    const retryAfterSeconds = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(resetAt).toISOString(),
      retryAfterSeconds
    };
  }

  return {
    allowed: true,
    remaining: Math.max(limit - count, 0),
    resetAt: new Date(resetAt).toISOString()
  };
}

function unlimitedDecision(): RagUsageLimitDecision {
  return {
    allowed: true,
    remaining: Number.MAX_SAFE_INTEGER,
    resetAt: new Date(nextDailyReset(Date.now())).toISOString()
  };
}

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function dayBucket(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function hourBucket(now: number): string {
  return new Date(now).toISOString().slice(0, 13).replace(/[-:T]/gu, "");
}

function nextHourReset(now: number): number {
  const date = new Date(now);
  date.setUTCMinutes(60, 0, 0);
  return date.getTime();
}

function nextDailyReset(now: number): number {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.getTime();
}
