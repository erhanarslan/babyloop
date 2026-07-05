import { describe, expect, it } from "vitest";
import {
  assertChildNotebookReminderReadinessOnly,
  evaluateChildNotebookReminder,
  getChildNotebookReminderReadiness
} from "../src/services/child-notebook-reminder-policy.service.js";

describe("child notebook reminder policy", () => {
  it("accepts a free child note without scheduling delivery", () => {
    const decision = evaluateChildNotebookReminder({
      childProfileId: "child_1",
      title: "Bez markası notu",
      type: "free_note",
      notificationPreferenceEnabled: false,
      childProfileActive: true,
      createdByProfileOwner: true
    });

    expect(decision).toMatchObject({
      valid: true,
      canSchedule: false,
      reasonCodes: ["valid"],
      requiresNotificationPreference: true,
      requiresOwnerAccess: true,
      deliveryMutationAllowed: false,
      providerCallAllowed: false,
      medicalAdviceAllowed: false,
      piiSafe: true
    });
  });

  it("accepts recurring feeding reminders while keeping delivery disabled", () => {
    const decision = evaluateChildNotebookReminder({
      childProfileId: "child_1",
      title: "Beslenme hatırlat",
      type: "feeding",
      dueAt: new Date(Date.now() + 60_000),
      frequency: "every_hours",
      intervalHours: 2,
      preferredTime: "10:00",
      notificationPreferenceEnabled: true,
      childProfileActive: true,
      createdByProfileOwner: true
    });

    expect(decision).toMatchObject({
      valid: true,
      canSchedule: true,
      frequency: "every_hours",
      advanceReminder: "none",
      deliveryMutationAllowed: false,
      providerCallAllowed: false
    });
  });

  it("accepts appointment reminders with advance notice", () => {
    const decision = evaluateChildNotebookReminder({
      childProfileId: "child_1",
      title: "Aktivite randevusu",
      type: "appointment",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      frequency: "once",
      advanceReminder: "one_week_before",
      preferredTime: "10:00",
      notificationPreferenceEnabled: true,
      childProfileActive: true,
      createdByProfileOwner: true
    });

    expect(decision).toMatchObject({
      valid: true,
      canSchedule: true,
      advanceReminder: "one_week_before"
    });
  });

  it("blocks invalid reminder inputs and disabled preferences", () => {
    const decision = evaluateChildNotebookReminder({
      childProfileId: "",
      title: "",
      type: "feeding",
      frequency: "every_hours",
      intervalHours: 0,
      preferredTime: "25:00",
      notificationPreferenceEnabled: false,
      childProfileActive: false,
      createdByProfileOwner: false
    });

    expect(decision.valid).toBe(false);
    expect(decision.canSchedule).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "missing_child_profile",
        "missing_title",
        "inactive_child_profile",
        "not_profile_owner",
        "invalid_interval",
        "invalid_preferred_time",
        "notification_preference_disabled"
      ])
    );
  });

  it("keeps medical and therapy boundaries closed", () => {
    const decision = evaluateChildNotebookReminder({
      childProfileId: "child_1",
      title: "İlaç doz ve tedavi planı",
      type: "other",
      dueAt: new Date(Date.now() + 60_000),
      notificationPreferenceEnabled: true,
      childProfileActive: true,
      createdByProfileOwner: true
    });

    expect(decision.valid).toBe(false);
    expect(decision.reasonCodes).toContain("medical_boundary_required");
    expect(decision.medicalAdviceAllowed).toBe(false);
    expect(decision.therapyAdviceAllowed).toBe(false);
    expect(decision.drugAdviceAllowed).toBe(false);
    expect(decision.dietPrescriptionAllowed).toBe(false);
  });

  it("exposes readiness-only required flows and disabled runtime delivery", () => {
    const readiness = getChildNotebookReminderReadiness();

    expect(readiness).toMatchObject({
      status: "readiness_only",
      runtimeCrudEnabled: false,
      notificationDeliveryEnabled: false,
      providerCallsAllowed: false,
      queueJobsAllowed: false,
      medicalAdviceAllowed: false
    });

    expect(readiness.requiredFlows).toEqual(
      expect.arrayContaining([
        "create free note",
        "create recurring reminder",
        "create every 2 hours feeding reminder",
        "create advance reminder one week before",
        "choose reminder time",
        "complete reminder",
        "cancel reminder",
        "snooze reminder",
        "link reminder to notification preference",
        "web child notebook QA",
        "mobile child notebook QA",
        "no medical/therapy/diagnosis/drug/diet advice"
      ])
    );
  });

  it("exposes compact readiness-only assertion", () => {
    expect(assertChildNotebookReminderReadinessOnly()).toEqual({
      runtimeCrudEnabled: false,
      notificationDeliveryEnabled: false,
      providerCallsAllowed: false,
      queueJobsAllowed: false,
      medicalAdviceAllowed: false
    });
  });
});
