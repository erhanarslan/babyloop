import { describe, expect, it } from "vitest";
import { buildAnalyticsOverviewKpis, formatDuration } from "./analytics-dashboard-model";

describe("analytics dashboard model", () => {
  it("builds aggregate KPI cards without sensitive fields", () => {
    const cards = buildAnalyticsOverviewKpis({
      activeUsers: 5,
      assistantUsers: 2,
      averageSessionEngagementMs: 90_000,
      chatUsers: 1,
      checkoutUsers: 1,
      conversationsStarted: 1,
      dau: 5,
      favoriteUsers: 2,
      googleLinkedRate: 25,
      googleLinkedUsers: 1,
      lastRollupAt: null,
      listingViews: 10,
      messageSenders: 1,
      pageViews: 12,
      passwordUsers: 3,
      screenViews: 4,
      sessions: 6,
      totalRegisteredUsers: 4,
      uniqueListingViewers: 3,
      verifiedRate: 50,
      verifiedUsers: 2
    });

    expect(cards).toEqual(expect.arrayContaining([
      { label: "Verified users", value: "2 (50%)" },
      { label: "Avg engagement", value: "1m 30s" }
    ]));
    expect(JSON.stringify(cards)).not.toMatch(/password|token|cookie|messageBody|assistantPrompt/iu);
  });

  it("formats duration compactly", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(15_000)).toBe("15s");
    expect(formatDuration(60_000)).toBe("1m");
  });
});
