const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type WebAnalyticsSessionState = {
  sessionId: string;
  anonymousId: string;
  lastSeenAt: number;
};

export function shouldStartNewWebAnalyticsSession(
  current: WebAnalyticsSessionState | null,
  now: number
): boolean {
  if (!current) {
    return true;
  }

  return now - current.lastSeenAt > SESSION_TIMEOUT_MS;
}

export function shouldSendWebEngagementHeartbeat(input: {
  documentVisible: boolean;
  windowFocused: boolean;
  deltaMs: number;
}): boolean {
  return input.documentVisible && input.windowFocused && input.deltaMs > 0;
}

export function createWebAnalyticsSession(input: {
  anonymousId: string;
  now: number;
  randomId: () => string;
}): WebAnalyticsSessionState {
  return {
    anonymousId: input.anonymousId,
    lastSeenAt: input.now,
    sessionId: input.randomId()
  };
}
