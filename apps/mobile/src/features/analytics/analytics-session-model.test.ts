import {
  clampMobileEngagementDelta,
  createMobileAnalyticsSession,
  shouldCountMobileEngagement,
  shouldStartNewMobileAnalyticsSession
} from "./analytics-session-model";

describe("mobile analytics session model", () => {
  it("starts a new session after inactivity", () => {
    expect(shouldStartNewMobileAnalyticsSession(null, 0)).toBe(true);
    expect(
      shouldStartNewMobileAnalyticsSession({
        anonymousId: "anon",
        lastActiveAt: 0,
        sessionId: "session"
      }, 31 * 60 * 1000)
    ).toBe(true);
  });

  it("counts engagement only while active", () => {
    expect(shouldCountMobileEngagement("active")).toBe(true);
    expect(shouldCountMobileEngagement("background")).toBe(false);
    expect(clampMobileEngagementDelta(45_000)).toBe(30_000);
  });

  it("creates session state with injected id", () => {
    expect(createMobileAnalyticsSession({
      anonymousId: "anon",
      now: 10,
      randomId: () => "session-1"
    })).toEqual({
      anonymousId: "anon",
      lastActiveAt: 10,
      sessionId: "session-1"
    });
  });
});
