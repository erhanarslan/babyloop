import type { FastifyInstance } from "fastify";
import type { ChildProfileReminderResponse } from "./child-profile-notes-reminders.service.js";
import {
  buildNotificationDeliveryLogRecord,
  canWriteNotificationDeliveryCandidateLog,
  createNotificationDeliveryCandidateLog,
  type NotificationDeliveryLogRecord
} from "./notification-delivery-log.service.js";
import {
  evaluateNotificationDeliveryPolicy,
  type NotificationDeliveryPolicyInput
} from "./notification-delivery-policy.service.js";

export type ChildReminderDeliveryCandidate = {
  kind: "child_reminder";
  sourceType: "child_profile";
  sourceId: string;
  profileId: string;
  childProfileId: string;
  reminderId: string;
  channel: ChildProfileReminderResponse["channel"];
  actionHref: string;
  status: "candidate" | "blocked";
  deliveryAllowed: false;
  draftOnly: true;
  canWriteLog: boolean;
  blockedReason: "frequency_window_active" | null;
  log: NotificationDeliveryLogRecord;
  note: "Bu kayıt çocuk hatırlatıcısı için delivery candidate üretir; email, push veya n8n gönderimi yapmaz.";
};

export type BuildChildReminderDeliveryCandidateInput = {
  profileId: string;
  reminder: ChildProfileReminderResponse;
  childLabel?: string | null;
  lastCandidateCreatedAt?: Date | string | null;
  now?: Date;
};

export type ChildReminderDeliverySkipReason =
  | "reminder_not_scheduled"
  | "reminder_not_due"
  | "reminder_invalid_date";

export type CreateChildReminderDeliveryCandidateLogResult =
  | {
      status: "skipped";
      reason: ChildReminderDeliverySkipReason;
    }
  | {
      status: "blocked";
      reason: "frequency_window_active";
      idempotencyKey: string;
    }
  | {
      status: "created" | "duplicate";
      idempotencyKey: string;
    };

export function buildChildReminderDeliveryPolicyInput(
  profileId: string,
  reminder: ChildProfileReminderResponse
): NotificationDeliveryPolicyInput {
  return {
    profileId,
    kind: "child_reminder",
    sourceType: "child_profile",
    sourceId: reminder.id,
    channel: reminder.channel,
    actionHref: buildChildReminderActionHref(reminder)
  };
}

export function getChildReminderDeliveryCandidateSkipReason(
  reminder: ChildProfileReminderResponse,
  now: Date = new Date()
): ChildReminderDeliverySkipReason | null {
  if (reminder.status !== "scheduled") {
    return "reminder_not_scheduled";
  }

  const remindAt = new Date(reminder.remindAt);

  if (Number.isNaN(remindAt.getTime())) {
    return "reminder_invalid_date";
  }

  if (remindAt.getTime() > now.getTime()) {
    return "reminder_not_due";
  }

  return null;
}

export function buildChildReminderDeliveryCandidate(
  input: BuildChildReminderDeliveryCandidateInput
): ChildReminderDeliveryCandidate | null {
  const skipReason = getChildReminderDeliveryCandidateSkipReason(input.reminder, input.now ?? new Date());

  if (skipReason) {
    return null;
  }

  const policyInput = buildChildReminderDeliveryPolicyInput(input.profileId, input.reminder);
  const policy = evaluateNotificationDeliveryPolicy(policyInput);
  const frequencyWindowInput: Parameters<typeof canWriteNotificationDeliveryCandidateLog>[0] = {
    frequencyWindowHours: policy.frequencyWindowHours
  };

  if (input.lastCandidateCreatedAt !== undefined) {
    frequencyWindowInput.lastLogCreatedAt = input.lastCandidateCreatedAt;
  }

  if (input.now !== undefined) {
    frequencyWindowInput.now = input.now;
  }

  const decision = canWriteNotificationDeliveryCandidateLog(frequencyWindowInput);
  const status = decision.canWrite ? "candidate" : "blocked";

  const logInput: Parameters<typeof buildNotificationDeliveryLogRecord>[0] = {
    profileId: input.profileId,
    policyInput,
    policy,
    status,
    metadata: {
      childProfileId: input.reminder.childProfileId,
      reminderId: input.reminder.id,
      reminderTitle: input.reminder.title,
      childLabel: input.childLabel ?? null,
      remindAt: input.reminder.remindAt,
      reminderStatus: input.reminder.status,
      reminderChannel: input.reminder.channel
    }
  };

  if (input.now !== undefined) {
    logInput.now = input.now;
  }

  return {
    kind: "child_reminder",
    sourceType: "child_profile",
    sourceId: input.reminder.id,
    profileId: input.profileId,
    childProfileId: input.reminder.childProfileId,
    reminderId: input.reminder.id,
    channel: input.reminder.channel,
    actionHref: policyInput.actionHref,
    status,
    deliveryAllowed: false,
    draftOnly: true,
    canWriteLog: decision.canWrite,
    blockedReason: decision.reason,
    log: buildNotificationDeliveryLogRecord(logInput),
    note: "Bu kayıt çocuk hatırlatıcısı için delivery candidate üretir; email, push veya n8n gönderimi yapmaz."
  };
}

export async function createChildReminderDeliveryCandidateLog(
  app: FastifyInstance,
  input: BuildChildReminderDeliveryCandidateInput
): Promise<CreateChildReminderDeliveryCandidateLogResult> {
  const skipReason = getChildReminderDeliveryCandidateSkipReason(input.reminder, input.now ?? new Date());

  if (skipReason) {
    return {
      status: "skipped",
      reason: skipReason
    };
  }

  const candidate = buildChildReminderDeliveryCandidate(input);

  if (!candidate) {
    return {
      status: "skipped",
      reason: "reminder_not_scheduled"
    };
  }

  if (!candidate.canWriteLog) {
    return {
      status: "blocked",
      reason: "frequency_window_active",
      idempotencyKey: candidate.log.idempotencyKey
    };
  }

  const policyInput = buildChildReminderDeliveryPolicyInput(input.profileId, input.reminder);
  const createInput: Parameters<typeof createNotificationDeliveryCandidateLog>[1] = {
    profileId: input.profileId,
    policyInput,
    policy: evaluateNotificationDeliveryPolicy(policyInput),
    metadata: candidate.log.metadata
  };

  if (input.now !== undefined) {
    createInput.now = input.now;
  }

  const result = await createNotificationDeliveryCandidateLog(app, createInput);

  return {
    status: result.created ? "created" : "duplicate",
    idempotencyKey: result.idempotencyKey
  };
}

function buildChildReminderActionHref(reminder: ChildProfileReminderResponse): string {
  const params = new URLSearchParams({
    childProfileId: reminder.childProfileId,
    reminderId: reminder.id
  });

  return `/account/children?${params.toString()}`;
}
