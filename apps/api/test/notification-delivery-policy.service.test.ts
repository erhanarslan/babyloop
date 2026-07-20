import { describe, expect, it } from "vitest";
import {
  evaluateNotificationDeliveryPolicy,
  getNotificationDeliveryPolicyPreview
} from "../src/services/notification-delivery-policy.service.js";

describe("notification delivery policy service", () => {
  it("keeps delivery disabled and returns a stable dedup key", () => {
    const result = evaluateNotificationDeliveryPolicy({
      profileId: "profile-1",
      kind: "saved_search",
      sourceType: "saved_search",
      sourceId: "saved-search-1",
      channel: "in_app",
      actionHref: "/browse?q=oto%20koltu%C4%9Fu"
    });

    expect(result.deliveryAllowed).toBe(false);
    expect(result.draftOnly).toBe(true);
    expect(result.dedupKey).toContain("profile-1");
    expect(result.dedupKey).toContain("saved_search");
    expect(result.frequencyWindowHours).toBe(24);
    expect(result.blockedReasons).toContain("delivery_disabled");
    expect(result.requirements.deliveryLogRequired).toBe(true);
    expect(result.requirements.idempotencyRequired).toBe(true);
  });

  it("allows delivery only through the explicit policy gate", () => {
    const input = {
      profileId: "profile-1",
      kind: "message_received" as const,
      sourceType: "conversation" as const,
      sourceId: "conversation-1",
      channel: "email" as const,
      actionHref: "/conversations/conversation-1"
    };

    expect(evaluateNotificationDeliveryPolicy(input)).toMatchObject({
      deliveryAllowed: false,
      draftOnly: true
    });
    expect(evaluateNotificationDeliveryPolicy(input, { deliveryEnabled: true })).toMatchObject({
      deliveryAllowed: true,
      draftOnly: false,
      blockedReasons: []
    });
  });

  it("uses longer frequency windows for child lifecycle cadence", () => {
    const weekly = evaluateNotificationDeliveryPolicy({
      profileId: "profile-1",
      kind: "child_lifecycle",
      sourceType: "child_profile",
      sourceId: "child-1",
      channel: "email_draft",
      actionHref: "/browse?categoryId=cat-1",
      cadence: "weekly"
    });

    const monthly = evaluateNotificationDeliveryPolicy({
      profileId: "profile-1",
      kind: "child_lifecycle",
      sourceType: "child_profile",
      sourceId: "child-1",
      channel: "email_draft",
      actionHref: "/browse?categoryId=cat-1",
      cadence: "monthly"
    });

    const yearly = evaluateNotificationDeliveryPolicy({
      profileId: "profile-1",
      kind: "child_lifecycle",
      sourceType: "child_profile",
      sourceId: "child-1",
      channel: "email_draft",
      actionHref: "/browse?categoryId=cat-1",
      cadence: "yearly"
    });

    expect(weekly.frequencyWindowHours).toBe(24 * 7);
    expect(monthly.frequencyWindowHours).toBe(24 * 30);
    expect(yearly.frequencyWindowHours).toBe(24 * 365);
  });

  it("exposes required send prerequisites", () => {
    const preview = getNotificationDeliveryPolicyPreview();

    expect(preview.sendEnabled).toBe(false);
    expect(preview.draftOnly).toBe(true);
    expect(preview.requiredBeforeSend).toContain("notification_delivery_logs schema");
    expect(preview.requiredBeforeSend).toContain("idempotency key for n8n/email hooks");
  });
});
