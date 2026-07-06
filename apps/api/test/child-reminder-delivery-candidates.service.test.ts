import { describe, expect, it } from "vitest";
import {
  buildChildReminderDeliveryCandidate,
  buildChildReminderDeliveryPolicyInput,
  getChildReminderDeliveryCandidateSkipReason
} from "../src/services/child-reminder-delivery-candidates.service.js";
import type { ChildProfileReminderResponse } from "../src/services/child-profile-notes-reminders.service.js";

const scheduledReminder: ChildProfileReminderResponse = {
  id: "reminder-1",
  childProfileId: "child-1",
  title: "Bez al",
  description: "Hafta sonu alışveriş listesine ekle. parent@example.com accessToken",
  remindAt: "2030-01-01T10:00:00.000Z",
  channel: "in_app",
  status: "scheduled",
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z"
};

describe("child reminder delivery candidates", () => {
  it("builds a draft-only child reminder candidate without enabling delivery", () => {
    const candidate = buildChildReminderDeliveryCandidate({
      profileId: "profile-1",
      reminder: scheduledReminder,
      childLabel: "Çocuğum",
      now: new Date("2030-01-01T10:00:00.000Z")
    });

    expect(candidate).toMatchObject({
      kind: "child_reminder",
      sourceType: "child_profile",
      sourceId: "reminder-1",
      profileId: "profile-1",
      childProfileId: "child-1",
      reminderId: "reminder-1",
      channel: "in_app",
      status: "candidate",
      deliveryAllowed: false,
      draftOnly: true,
      canWriteLog: true,
      blockedReason: null
    });
    expect(candidate?.actionHref).toContain("/account/children?");
    expect(candidate?.log).toMatchObject({
      kind: "child_reminder",
      sourceType: "child_profile",
      sourceId: "reminder-1",
      channel: "in_app",
      status: "candidate",
      deliveryAllowed: false,
      draftOnly: true,
      frequencyWindowHours: 24
    });
    expect(candidate?.log.blockedReasons).toContain("delivery_disabled");
    expect(candidate?.log.blockedReasons).toContain("delivery_log_required");
    expect(candidate?.note).toContain("email, push veya n8n gönderimi yapmaz");
    expect(JSON.stringify(candidate)).not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization|sendPush|sendEmail|n8n hook/iu);
  });

  it("uses stable policy input for child reminder idempotency", () => {
    const input = buildChildReminderDeliveryPolicyInput("profile-1", scheduledReminder);

    expect(input).toEqual({
      profileId: "profile-1",
      kind: "child_reminder",
      sourceType: "child_profile",
      sourceId: "reminder-1",
      channel: "in_app",
      actionHref: "/account/children?childProfileId=child-1&reminderId=reminder-1"
    });
  });

  it("blocks duplicate child reminder candidates inside the frequency window", () => {
    const candidate = buildChildReminderDeliveryCandidate({
      profileId: "profile-1",
      reminder: scheduledReminder,
      lastCandidateCreatedAt: "2030-01-01T10:00:00.000Z",
      now: new Date("2030-01-01T20:00:00.000Z")
    });

    expect(candidate).toMatchObject({
      status: "blocked",
      canWriteLog: false,
      blockedReason: "frequency_window_active"
    });
    expect(candidate?.log.status).toBe("blocked");
  });

  it("skips completed reminders instead of creating delivery candidates", () => {
    const candidate = buildChildReminderDeliveryCandidate({
      profileId: "profile-1",
      reminder: {
        ...scheduledReminder,
        status: "completed",
        completedAt: "2026-07-05T10:00:00.000Z"
      }
    });

    expect(candidate).toBeNull();
  });

  it("skips future reminders until remindAt is due", () => {
    const candidate = buildChildReminderDeliveryCandidate({
      profileId: "profile-1",
      reminder: scheduledReminder,
      now: new Date("2026-07-05T00:00:00.000Z")
    });

    expect(candidate).toBeNull();
    expect(
      getChildReminderDeliveryCandidateSkipReason(
        scheduledReminder,
        new Date("2026-07-05T00:00:00.000Z")
      )
    ).toBe("reminder_not_due");
  });

  it("reports invalid reminder dates as skipped without provider calls", () => {
    const invalidReminder: ChildProfileReminderResponse = {
      ...scheduledReminder,
      remindAt: "not-a-date"
    };

    expect(
      getChildReminderDeliveryCandidateSkipReason(
        invalidReminder,
        new Date("2030-01-01T10:00:00.000Z")
      )
    ).toBe("reminder_invalid_date");
    expect(
      buildChildReminderDeliveryCandidate({
        profileId: "profile-1",
        reminder: invalidReminder,
        now: new Date("2030-01-01T10:00:00.000Z")
      })
    ).toBeNull();
  });

  it("supports email_draft reminders without sending email", () => {
    const candidate = buildChildReminderDeliveryCandidate({
      profileId: "profile-1",
      reminder: {
        ...scheduledReminder,
        id: "reminder-email-draft",
        channel: "email_draft"
      },
      now: new Date("2030-01-01T10:00:00.000Z")
    });

    expect(candidate?.channel).toBe("email_draft");
    expect(candidate?.log.channel).toBe("email_draft");
    expect(candidate?.deliveryAllowed).toBe(false);
    expect(candidate?.draftOnly).toBe(true);
    expect(JSON.stringify(candidate)).not.toMatch(/sent|sendEmail|EMAIL_SEND_ENABLED=true|push gönderildi|n8n çalıştı/iu);
  });
});
