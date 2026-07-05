import { describe, expect, it } from "vitest";
import {
  evaluateNotificationDeliveryTransition,
  getNotificationDeliveryTransitionPreview
} from "../src/services/notification-delivery-transitions.service.js";

describe("notification delivery transitions", () => {
  it("allows draft-only candidate skip without enabling delivery", () => {
    const decision = evaluateNotificationDeliveryTransition({
      currentStatus: "candidate",
      targetStatus: "skipped",
      reason: "admin closed candidate parent@example.com accessToken",
      actorProfileId: "profile-1",
      now: new Date("2026-07-05T00:00:00.000Z")
    });

    expect(decision).toMatchObject({
      currentStatus: "candidate",
      targetStatus: "skipped",
      allowed: true,
      deliveryAllowed: false,
      draftOnly: true,
      reason: "draft_only_skip"
    });
    expect(decision.requires).toMatchObject({
      deliveryLog: true,
      idempotencyKey: true,
      adminAudit: true,
      providerSandbox: true
    });
    expect(decision.note).toContain("email, push, n8n veya queue gönderimi yapılmaz");
    expect(JSON.stringify(decision)).not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization/iu);
  });

  it("allows draft-only candidate blocking but does not send", () => {
    const decision = evaluateNotificationDeliveryTransition({
      currentStatus: "candidate",
      targetStatus: "blocked",
      reason: "frequency window"
    });

    expect(decision).toMatchObject({
      allowed: true,
      deliveryAllowed: false,
      draftOnly: true,
      reason: "draft_only_block"
    });
    expect(JSON.stringify(decision)).not.toMatch(/sendEmail|sendPush|sendN8n|EMAIL_SEND_ENABLED=true|hooks\.slack|api\.resend/iu);
  });

  it("blocks sent transition while delivery is disabled", () => {
    const decision = evaluateNotificationDeliveryTransition({
      currentStatus: "candidate",
      targetStatus: "sent",
      reason: "try to send"
    });

    expect(decision).toMatchObject({
      allowed: false,
      deliveryAllowed: false,
      draftOnly: true,
      reason: "delivery_disabled"
    });
    expect(decision.note).toContain("Draft-only modda");
  });

  it("blocks failed transition until provider attempt/retry policy exists", () => {
    const decision = evaluateNotificationDeliveryTransition({
      currentStatus: "candidate",
      targetStatus: "failed",
      reason: "provider failed"
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "provider_not_configured"
    });
    expect(decision.note).toContain("Provider sandbox");
  });

  it("blocks terminal status transitions", () => {
    const decision = evaluateNotificationDeliveryTransition({
      currentStatus: "sent",
      targetStatus: "skipped"
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "terminal_status"
    });
  });

  it("exposes a safe transition preview for ops surfaces", () => {
    const preview = getNotificationDeliveryTransitionPreview();

    expect(preview).toMatchObject({
      draftOnly: true,
      deliveryAllowed: false,
      terminalStatuses: ["sent", "failed", "skipped"]
    });
    expect(preview.allowedDraftOnlyTransitions).toEqual(
      expect.arrayContaining([
        { from: "candidate", to: "blocked", reason: "draft_only_block" },
        { from: "candidate", to: "skipped", reason: "draft_only_skip" }
      ])
    );
    expect(preview.futureSenderTransitions[0]?.blockedUntil).toContain("provider sandbox");
    expect(preview.privacyNote).toContain("metadata, idempotency key, dedup key");
  });
});
