import type { FastifyInstance } from "fastify";
import {
  advanceChildProfileReminderAfterTrigger,
  listDueChildProfileReminders
} from "./child-profile-notes-reminders.service.js";
import {
  createChildReminderDeliveryCandidateLog,
  type BuildChildReminderDeliveryCandidateInput
} from "./child-reminder-delivery-candidates.service.js";
import { isNotificationPreferenceEnabledForDelivery } from "./notification-preferences.service.js";

export type ChildReminderDeliveryChannel = NonNullable<BuildChildReminderDeliveryCandidateInput["channel"]>;

export type ProcessDueChildRemindersInput = {
  now?: Date;
  limit?: number;
  dryRun?: boolean;
  channels?: ChildReminderDeliveryChannel[];
};

export type ProcessDueChildReminderResult = {
  reminderId: string;
  childProfileId: string;
  profileId: string;
  channel: ChildReminderDeliveryChannel;
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
  channels: ChildReminderDeliveryChannel[];
  results: ProcessDueChildReminderResult[];
  providerCallsAllowed: boolean;
  deliveryAllowed: boolean;
  note: string;
};

const DEFAULT_CHILD_REMINDER_DELIVERY_CHANNELS: ChildReminderDeliveryChannel[] = ["in_app"];

export async function processDueChildReminderNotifications(
  app: FastifyInstance,
  input: ProcessDueChildRemindersInput = {}
): Promise<ProcessDueChildRemindersSummary> {
  const now = input.now ?? new Date();
  const dryRun = input.dryRun ?? false;
  const channels = normalizeChildReminderDeliveryChannels(input.channels);
  const dueReminders = await listDueChildProfileReminders(app, now, input.limit ?? 50);
  const results: ProcessDueChildReminderResult[] = [];

  for (const reminder of dueReminders) {
    let shouldAdvanceReminder = false;

    for (const channel of channels) {
      const preferenceEnabled = await isNotificationPreferenceEnabledForDelivery(
        app,
        reminder.ownerProfileId,
        "child_reminder",
        toPreferenceChannel(channel)
      );

      if (!preferenceEnabled) {
        results.push({
          reminderId: reminder.id,
          childProfileId: reminder.childProfileId,
          profileId: reminder.ownerProfileId,
          channel,
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
          channel,
          status: "dry_run",
          reason: "dry_run",
          idempotencyKey: null
        });
        continue;
      }

      const logResult = await createChildReminderDeliveryCandidateLog(app, {
        profileId: reminder.ownerProfileId,
        channel,
        childLabel: reminder.childLabel,
        reminder,
        now
      });

      results.push({
        reminderId: reminder.id,
        childProfileId: reminder.childProfileId,
        profileId: reminder.ownerProfileId,
        channel,
        status: logResult.status,
        reason: "reason" in logResult ? logResult.reason : null,
        idempotencyKey: "idempotencyKey" in logResult ? logResult.idempotencyKey : null
      });

      if (logResult.status === "created" || logResult.status === "duplicate") {
        shouldAdvanceReminder = true;
      }
    }

    if (shouldAdvanceReminder) {
      await advanceChildProfileReminderAfterTrigger(app, reminder, now);
    }
  }

  const providerChannelsEnabled = channels.some(isProviderDeliveryChannel);

  return {
    processed: results.length,
    created: results.filter((result) => result.status === "created" || result.status === "duplicate").length,
    skipped: results.filter((result) => result.status === "skipped" || result.status === "dry_run").length,
    blocked: results.filter((result) => result.status === "blocked").length,
    dryRun,
    channels,
    results,
    providerCallsAllowed: providerChannelsEnabled,
    deliveryAllowed: providerChannelsEnabled,
    note: providerChannelsEnabled
      ? "Processes child reminder delivery candidates for configured channels. Provider sending is still executed by the notification provider processor."
      : "Processes child reminder due candidates without real email, push, SMS, n8n, queue, or provider sending."
  };
}

function normalizeChildReminderDeliveryChannels(
  channels: ChildReminderDeliveryChannel[] | undefined
): ChildReminderDeliveryChannel[] {
  const normalized = (channels && channels.length > 0 ? channels : DEFAULT_CHILD_REMINDER_DELIVERY_CHANNELS)
    .filter(isSupportedChildReminderDeliveryChannel);

  return Array.from(new Set(normalized));
}

function isSupportedChildReminderDeliveryChannel(value: string): value is ChildReminderDeliveryChannel {
  return value === "in_app" || value === "email_draft" || value === "email" || value === "push" || value === "n8n";
}

function toPreferenceChannel(channel: ChildReminderDeliveryChannel): "email" | "push" | "in_app" | "n8n" {
  if (channel === "email" || channel === "email_draft") {
    return "email";
  }

  if (channel === "push") {
    return "push";
  }

  if (channel === "n8n") {
    return "n8n";
  }

  return "in_app";
}

function isProviderDeliveryChannel(channel: ChildReminderDeliveryChannel): boolean {
  return channel === "email" || channel === "push" || channel === "n8n";
}
