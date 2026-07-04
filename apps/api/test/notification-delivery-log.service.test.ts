import { describe, expect, it } from "vitest";
import { evaluateNotificationDeliveryPolicy } from "../src/services/notification-delivery-policy.service.js";
import {
  buildNotificationDeliveryIdempotencyKey,
  buildNotificationDeliveryLogRecord,
  canWriteNotificationDeliveryCandidateLog,
  isNotificationDeliveryWithinFrequencyWindow
} from "../src/services/notification-delivery-log.service.js";

describe("notification delivery log service", () => {
  it("builds a stable draft-only candidate log without enabling delivery", () => {
    const policyInput = {
      profileId: "profile-1",
      kind: "saved_search",
      sourceType: "saved_search",
      sourceId: "saved-search-1",
      channel: "in_app",
      actionHref: "/browse?savedSearchId=saved-search-1"
    } as const;
    const policy = evaluateNotificationDeliveryPolicy(policyInput);

    const log = buildNotificationDeliveryLogRecord({
      profileId: policyInput.profileId,
      policyInput,
      policy,
      now: new Date("2026-07-05T00:00:00.000Z"),
      metadata: {
        safeLabel: "Puset araması",
        email: "parent@example.com",
        accessToken: "secret-token",
        body: "raw body should not persist"
      }
    });

    expect(log).toMatchObject({
      profileId: "profile-1",
      kind: "saved_search",
      sourceType: "saved_search",
      sourceId: "saved-search-1",
      channel: "in_app",
      status: "candidate",
      dedupKey: policy.dedupKey,
      frequencyWindowHours: 24,
      deliveryAllowed: false,
      draftOnly: true,
      createdAt: "2026-07-05T00:00:00.000Z"
    });
    expect(log.idempotencyKey).toBe(buildNotificationDeliveryIdempotencyKey(policyInput, policy));
    expect(log.blockedReasons).toContain("delivery_disabled");
    expect(log.blockedReasons).toContain("delivery_log_required");
    expect(log.metadata).toEqual({ safeLabel: "Puset araması" });
    expect(JSON.stringify(log)).not.toMatch(/parent@example.com|secret-token|raw body|accessToken|refreshToken|passwordHash|otpCode/iu);
  });

  it("blocks duplicate candidate writes inside the frequency window", () => {
    expect(
      isNotificationDeliveryWithinFrequencyWindow({
        lastLogCreatedAt: "2026-07-05T00:00:00.000Z",
        now: new Date("2026-07-05T10:00:00.000Z"),
        frequencyWindowHours: 24
      })
    ).toBe(true);

    expect(
      canWriteNotificationDeliveryCandidateLog({
        lastLogCreatedAt: "2026-07-05T00:00:00.000Z",
        now: new Date("2026-07-05T10:00:00.000Z"),
        frequencyWindowHours: 24
      })
    ).toEqual({
      canWrite: false,
      reason: "frequency_window_active"
    });
  });

  it("allows candidate writes after the frequency window expires", () => {
    expect(
      canWriteNotificationDeliveryCandidateLog({
        lastLogCreatedAt: "2026-07-05T00:00:00.000Z",
        now: new Date("2026-07-06T01:00:00.000Z"),
        frequencyWindowHours: 24
      })
    ).toEqual({
      canWrite: true,
      reason: null
    });
  });
});
