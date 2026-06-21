export type RagUsageLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

type UsageEntry = {
  count: number;
  resetAt: number;
};

export class RagUsageLimitService {
  private readonly dailyGuestLimit: number;
  private readonly dailyUserLimit: number;
  private readonly entries = new Map<string, UsageEntry>();

  constructor(options: { dailyGuestLimit: number; dailyUserLimit: number }) {
    this.dailyGuestLimit = options.dailyGuestLimit;
    this.dailyUserLimit = options.dailyUserLimit;
  }

  consume(input: { key: string; authenticated: boolean }): RagUsageLimitDecision {
    const now = Date.now();
    const limit = input.authenticated ? this.dailyUserLimit : this.dailyGuestLimit;
    const existing = this.entries.get(input.key);
    const entry = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: nextDailyReset(now) };

    if (entry.count >= limit) {
      this.entries.set(input.key, entry);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt).toISOString()
      };
    }

    entry.count += 1;
    this.entries.set(input.key, entry);

    return {
      allowed: true,
      remaining: Math.max(limit - entry.count, 0),
      resetAt: new Date(entry.resetAt).toISOString()
    };
  }
}

function nextDailyReset(now: number): number {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.getTime();
}
