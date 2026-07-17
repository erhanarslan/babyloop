import { describe, expect, it } from "vitest";
import {
  createWebAnalyticsSession,
  shouldSendWebEngagementHeartbeat,
  shouldStartNewWebAnalyticsSession
} from "./analytics-session-model";

describe("web analytics session model", () => {
  it("starts a new session after inactivity", () => {
    expect(shouldStartNewWebAnalyticsSession(null, 100)).toBe(true);
    expect(
      shouldStartNewWebAnalyticsSession({
        anonymousId: "anon",
        lastSeenAt: 0,
        sessionId: "session"
      }, 31 * 60 * 1000)
    ).toBe(true);
  });

  it("counts engagement only while visible and focused", () => {
    expect(shouldSendWebEngagementHeartbeat({
      deltaMs: 1000,
      documentVisible: true,
      windowFocused: true
    })).toBe(true);
    expect(shouldSendWebEngagementHeartbeat({
      deltaMs: 1000,
      documentVisible: false,
      windowFocused: true
    })).toBe(false);
  });

  it("creates deterministic session state with injected random id", () => {
    expect(createWebAnalyticsSession({
      anonymousId: "anon",
      now: 10,
      randomId: () => "session-1"
    })).toEqual({
      anonymousId: "anon",
      lastSeenAt: 10,
      sessionId: "session-1"
    });
  });
});
