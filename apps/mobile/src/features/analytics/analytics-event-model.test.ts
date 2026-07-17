import {
  buildMobileAnalyticsEvent,
  enqueueMobileAnalyticsEvent,
  sanitizeMobileAnalyticsProperties,
  takeMobileAnalyticsBatch
} from "./analytics-event-model";

describe("mobile analytics event model", () => {
  it("builds mobile envelopes without raw prompt/body fields", () => {
    const event = buildMobileAnalyticsEvent({
      anonymousId: "anon-mobile",
      eventId: "event-mobile",
      eventName: "assistant_answer_received",
      occurredAt: new Date("2026-07-17T10:00:00.000Z"),
      properties: {
        assistantPrompt: "private prompt",
        domain: "feeding",
        grounded: true,
        mode: "rag",
        sourceCount: 1
      },
      screenName: "Listing Detail",
      sessionId: "session-mobile"
    });

    expect(event.platform).toBe("mobile");
    expect(event.screenName).toBe("listing_detail");
    expect(JSON.stringify(event)).not.toContain("private prompt");
  });

  it("keeps only allowlisted properties", () => {
    expect(
      sanitizeMobileAnalyticsProperties("child_reminder_created", {
        reminderCategory: "feeding",
        scheduleKind: "daily",
        title: "private reminder"
      })
    ).toEqual({
      reminderCategory: "feeding",
      scheduleKind: "daily"
    });
  });

  it("keeps offline queue capped and batches FIFO", () => {
    const queue = enqueueMobileAnalyticsEvent([1, 2, 3], 4, 3);
    expect(queue).toEqual([2, 3, 4]);

    expect(takeMobileAnalyticsBatch([1, 2, 3], 2)).toEqual({
      batch: [1, 2],
      remaining: [3]
    });
  });
});
