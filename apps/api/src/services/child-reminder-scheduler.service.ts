import type { FastifyInstance } from "fastify";
import {
  advanceChildProfileReminderAfterTrigger,
  listDueChildProfileReminders
} from "./child-profile-notes-reminders.service.js";
import { createChildReminderDeliveryCandidateLog } from "./child-reminder-delivery-candidates.service.js";
import { isNotificationPreferenceEnabledForDelivery } from "./notification-preferences.service.js";

export type ProcessDueChildRemindersInput = {
  now?: Date;
  limit?: number;
  dryRun?: boolean;
};

export type ProcessDueChildReminderResult = {
  reminderId: string;
  childProfileId: string;
  profileId: string;
  status: "created" | "duplicate" | "skipped" | "blocked" | "dry_run";
  reason:
    | "preference_disabled"
    | "frequency_window_active"
    | "reminder_not_scheduled"
    | "reminder_not_due"
    | "reminder_invalid_date"
    | "dry_run"
    | null;
  idempotencyKey: string | null;
};

export type ProcessDueChildRemindersSummary = {
  processed: number;
  created: number;
  skipped: number;
  blocked: number;
  dryRun: boolean;
  results: ProcessDueChildReminderResult[];
  providerCallsAllowed: false;
  deliveryAllowed: false;
  note: "Processes child reminder due candidates without real email, push, SMS, n8n, queue, or provider sending.";
};

export async function processDueChildReminderNotifications(
  app: FastifyInstance,
  input: ProcessDueChildRemindersInput = {}
): Promise<ProcessDueChildRemindersSummary> {
  const now = input.now ?? new Date();
  const dryRun = input.dryRun ?? false;
  const dueReminders = await listDueChildProfileReminders(app, now, input.limit ?? 50);
  const results: ProcessDueChildReminderResult[] = [];

  for (const reminder of dueReminders) {
    const preferenceEnabled = await isNotificationPreferenceEnabledForDelivery(
      app,
      reminder.ownerProfileId,
      "child_reminder",
      "in_app"
    );

    if (!preferenceEnabled) {
      results.push({
        reminderId: reminder.id,
        childProfileId: reminder.childProfileId,
        profileId: reminder.ownerProfileId,
        status: "skipped",
        reason: "preference_disabled",
        idempotencyKey: null
      });
      continue;
    }

    if (dryRun) {
      results.push({
        reminderId: reminder.id,
        childProfileId: reminder.childProfileId,
        profileId: reminder.ownerProfileId,
        status: "dry_run",
        reason: "dry_run",
        idempotencyKey: null
      });
      continue;
    }

    const logResult = await createChildReminderDeliveryCandidateLog(app, {
      profileId: reminder.ownerProfileId,
      childLabel: reminder.childLabel,
      reminder,
      now
    });

    results.push({
      reminderId: reminder.id,
      childProfileId: reminder.childProfileId,
      profileId: reminder.ownerProfileId,
      status: logResult.status,
      reason: "reason" in logResult ? logResult.reason : null,
      idempotencyKey: "idempotencyKey" in logResult ? logResult.idempotencyKey : null
    });

    if (logResult.status === "created" || logResult.status === "duplicate") {
      await advanceChildProfileReminderAfterTrigger(app, reminder, now);
    }
  }

  return {
    processed: results.length,
    created: results.filter((result) => result.status === "created" || result.status === "duplicate").length,
    skipped: results.filter((result) => result.status === "skipped" || result.status === "dry_run").length,
    blocked: results.filter((result) => result.status === "blocked").length,
    dryRun,
    results,
    providerCallsAllowed: false,
    deliveryAllowed: false,
    note: "Processes child reminder due candidates without real email, push, SMS, n8n, queue, or provider sending."
  };
}
