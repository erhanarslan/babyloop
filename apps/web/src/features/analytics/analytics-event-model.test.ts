import { describe, expect, it } from "vitest";
import {
  buildWebAnalyticsEvent,
  clampEngagementDelta,
  sanitizeProperties,
  stripUrlDetails,
  templateWebPath
} from "./analytics-event-model";

describe("web analytics event model", () => {
  it("strips query strings and templates sensitive route ids", () => {
    expect(stripUrlDetails("/listings/abc?token=secret#frag")).toBe("/listings/abc");
    expect(templateWebPath("/listings/abc?token=secret")).toBe("/listings/[id]");
    expect(templateWebPath("/conversations/c1")).toBe("/conversations/[id]");
  });

  it("keeps only allowlisted properties", () => {
    expect(
      sanitizeProperties("message_sent", {
        bodyLengthBucket: "1-50",
        conversationId: "conversation-1",
        messageBody: "private",
        password: "secret"
      })
    ).toEqual({
      bodyLengthBucket: "1-50",
      conversationId: "conversation-1"
    });
  });

  it("builds page view envelopes without raw query data", () => {
    const event = buildWebAnalyticsEvent({
      anonymousId: "anon-web",
      eventId: "event-web",
      eventName: "page_viewed",
      occurredAt: new Date("2026-07-17T10:00:00.000Z"),
      pathname: "/categories/strollers?email=a@example.test",
      sessionId: "session-web",
      properties: {
        pageGroup: "category"
      }
    });

    expect(event.pagePath).toBe("/categories/strollers");
    expect(event.properties?.routeTemplate).toBe("/categories/[slug]");
    expect(JSON.stringify(event)).not.toContain("a@example.test");
  });

  it("caps heartbeat deltas", () => {
    expect(clampEngagementDelta(45_000)).toBe(30_000);
    expect(clampEngagementDelta(-1)).toBe(0);
  });
});
