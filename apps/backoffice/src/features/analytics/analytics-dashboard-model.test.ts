import { describe, expect, it } from "vitest";
import { buildAnalyticsOverviewKpis, formatDuration } from "./analytics-dashboard-model";

describe("analytics dashboard model", () => {
  it("builds aggregate KPI cards without sensitive fields", () => {
    const cards = buildAnalyticsOverviewKpis({
      activeUsers: 5,
      activeCustomerUsers: 4,
      aggregationStatus: "pending",
      assistantAnswers: 3,
      assistantGroundedAnswers: 2,
      assistantGroundedRate: 66.67,
      assistantErrors: 1,
      assistantQuestions: 4,
      assistantUsers: 2,
      registrations: 2,
      successfulLogins: 3,
      failedLogins: 1,
      googleSuccessfulLogins: 2,
      emailVerifications: 1,
      mfaCompletions: 1,
      averageSessionEngagementMs: 90_000,
      chatUsers: 1,
      checkoutUsers: 1,
      contactIntents: 2,
      conversationsStarted: 1,
      dau: 5,
      dataSource: "raw_recent",
      demoSystemAccounts: 2,
      favoriteUsers: 2,
      googleLinkedRate: 25,
      googleLinkedUsers: 1,
      lastRollupAt: null,
      lastRawEventAt: "2026-07-31T10:00:00.000Z",
      listingViews: 10,
      messageSenders: 1,
      messagesSent: 3,
      messagesRead: 2,
      activeMessagingParticipants: 2,
      childProfilesCreated: 1,
      childNotesCreated: 2,
      childRemindersCreated: 3,
      pageViews: 12,
      passwordUsers: 3,
      rawEventsInRange: 40,
      screenViews: 4,
      sessions: 6,
      searches: 7,
      totalRegisteredUsers: 4,
      loginDisabledAccounts: 1,
      uniqueListingViewers: 3,
      verifiedRate: 50,
      verifiedUsers: 2
    });

    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Kullanıcılar", value: "4" }),
      expect.objectContaining({ label: "Etkileşim", value: "6 oturum" }),
      expect.objectContaining({ label: "Kimlik doğrulama", value: "2 kayıt" }),
      expect.objectContaining({ label: "Çocuk özellikleri", value: "1 profil oluşturma" })
    ]));
    expect(cards).toHaveLength(7);
    expect(cards.every((card) => card.details.length >= 2 && card.period && card.source)).toBe(true);
    expect(JSON.stringify(cards)).not.toMatch(/password|token|cookie|messageBody|assistantPrompt/iu);
  });

  it("formats duration compactly", () => {
    expect(formatDuration(0)).toBe("0 sn");
    expect(formatDuration(15_000)).toBe("15 sn");
    expect(formatDuration(60_000)).toBe("1 dk");
  });
});
