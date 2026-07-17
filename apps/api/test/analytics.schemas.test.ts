import { describe, expect, it } from "vitest";
import { analyticsEventBatchSchema } from "../src/schemas/analytics.schemas.js";

describe("analytics schemas", () => {
  it("accepts a privacy-safe batch event", () => {
    const result = analyticsEventBatchSchema.safeParse({
      events: [{
        anonymousId: "anon-analytics-schema",
        eventId: "event-analytics-schema-1",
        eventName: "listing_opened",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        platform: "web",
        sessionId: "session-analytics-schema",
        properties: {
          listingId: "00000000-0000-4000-8000-000000000001",
          sourceSurface: "browse"
        }
      }]
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown properties and sensitive user text", () => {
    expect(
      analyticsEventBatchSchema.safeParse({
        events: [{
          anonymousId: "anon-analytics-schema",
          eventId: "event-analytics-schema-2",
          eventName: "message_sent",
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          platform: "web",
          sessionId: "session-analytics-schema",
          properties: {
            conversationId: "00000000-0000-4000-8000-000000000002",
            messageBody: "private body"
          }
        }]
      }).success
    ).toBe(false);

    expect(
      analyticsEventBatchSchema.safeParse({
        events: [{
          anonymousId: "anon-analytics-schema",
          eventId: "event-analytics-schema-3",
          eventName: "assistant_question_submitted",
          eventVersion: 1,
          occurredAt: new Date().toISOString(),
          platform: "mobile",
          sessionId: "session-analytics-schema",
          properties: {
            assistantPrompt: "raw prompt"
          }
        }]
      }).success
    ).toBe(false);
  });
});
