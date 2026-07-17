const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type MobileAnalyticsAppState = "active" | "background" | "inactive";

export type MobileAnalyticsSessionState = {
  anonymousId: string;
  sessionId: string;
  lastActiveAt: number;
};

export function shouldStartNewMobileAnalyticsSession(
  current: MobileAnalyticsSessionState | null,
  now: number
): boolean {
  if (!current) {
    return true;
  }

  return now - current.lastActiveAt > SESSION_TIMEOUT_MS;
}

export function shouldCountMobileEngagement(state: MobileAnalyticsAppState): boolean {
  return state === "active";
}

export function clampMobileEngagementDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return 0;
  }

  return Math.min(Math.round(deltaMs), 30_000);
}

export function createMobileAnalyticsSession(input: {
  anonymousId: string;
  now: number;
  randomId: () => string;
}): MobileAnalyticsSessionState {
  return {
    anonymousId: input.anonymousId,
    lastActiveAt: input.now,
    sessionId: input.randomId()
  };
}
