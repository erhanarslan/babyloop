import { notificationDeliveryLogs } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type {
  NotificationDeliveryPolicyInput,
  NotificationDeliveryPolicyResult
} from "./notification-delivery-policy.service.js";

export type NotificationDeliveryLogStatus = "candidate" | "blocked" | "sent" | "failed" | "skipped";

export type NotificationDeliveryLogRecord = {
  profileId: string;
  kind: NotificationDeliveryPolicyInput["kind"];
  sourceType: NotificationDeliveryPolicyInput["sourceType"];
  sourceId: string;
  channel: NotificationDeliveryPolicyInput["channel"];
  status: NotificationDeliveryLogStatus;
  idempotencyKey: string;
  dedupKey: string;
  frequencyWindowHours: number;
  deliveryAllowed: false;
  draftOnly: true;
  blockedReasons: NotificationDeliveryPolicyResult["blockedReasons"];
  metadata: Record<string, unknown>;
  createdAt: string;
};

type BuildNotificationDeliveryLogRecordInput = {
  profileId: string;
  policyInput: NotificationDeliveryPolicyInput;
  policy: NotificationDeliveryPolicyResult;
  metadata?: Record<string, unknown>;
  now?: Date;
  status?: Extract<NotificationDeliveryLogStatus, "candidate" | "blocked">;
};

export type NotificationDeliveryFrequencyWindowInput = {
  lastLogCreatedAt?: Date | string | null;
  now?: Date;
  frequencyWindowHours: number;
};

export type NotificationDeliveryCandidateWriteDecision =
  | {
      canWrite: true;
      reason: null;
    }
  | {
      canWrite: false;
      reason: "frequency_window_active";
    };

export function truncateNotificationDeliveryLogRecord<T extends Record<string, unknown>>(record: T): T {
  const truncated = { ...record };

  for (const key of Object.keys(truncated) as Array<keyof T>) {
    const value = truncated[key];

    if (typeof value === "string" && value.length > 240) {
      truncated[key] = value.slice(0, 240) as T[typeof key];
    }
  }

  return truncated;
}

export function buildNotificationDeliveryLogRecord(
  input: BuildNotificationDeliveryLogRecordInput
): NotificationDeliveryLogRecord {
  return {
    profileId: input.profileId,
    kind: input.policyInput.kind,
    sourceType: input.policyInput.sourceType,
    sourceId: sanitizeDeliveryKeyPart(input.policyInput.sourceId),
    channel: input.policyInput.channel,
    status: input.status ?? "candidate",
    idempotencyKey: buildNotificationDeliveryIdempotencyKey(input.policyInput, input.policy),
    dedupKey: input.policy.dedupKey,
    frequencyWindowHours: input.policy.frequencyWindowHours,
    deliveryAllowed: false,
    draftOnly: true,
    blockedReasons: input.policy.blockedReasons,
    metadata: sanitizeNotificationDeliveryMetadata(input.metadata ?? {}),
    createdAt: (input.now ?? new Date()).toISOString()
  };
}

export function buildNotificationDeliveryIdempotencyKey(
  input: NotificationDeliveryPolicyInput,
  policy: Pick<NotificationDeliveryPolicyResult, "dedupKey">
): string {
  return [
    "notification_delivery",
    input.kind,
    input.sourceType,
    sanitizeDeliveryKeyPart(input.sourceId),
    input.channel,
    policy.dedupKey
  ].join(":");
}

export function isNotificationDeliveryWithinFrequencyWindow(
  input: NotificationDeliveryFrequencyWindowInput
): boolean {
  if (!input.lastLogCreatedAt) {
    return false;
  }

  if (!Number.isFinite(input.frequencyWindowHours) || input.frequencyWindowHours <= 0) {
    return false;
  }

  const now = input.now ?? new Date();
  const lastCreatedAt = typeof input.lastLogCreatedAt === "string" ? new Date(input.lastLogCreatedAt) : input.lastLogCreatedAt;

  if (Number.isNaN(lastCreatedAt.getTime())) {
    return false;
  }

  const windowMs = input.frequencyWindowHours * 60 * 60 * 1000;
  return now.getTime() - lastCreatedAt.getTime() < windowMs;
}

export function canWriteNotificationDeliveryCandidateLog(
  input: NotificationDeliveryFrequencyWindowInput
): NotificationDeliveryCandidateWriteDecision {
  if (isNotificationDeliveryWithinFrequencyWindow(input)) {
    return {
      canWrite: false,
      reason: "frequency_window_active"
    };
  }

  return {
    canWrite: true,
    reason: null
  };
}

export async function createNotificationDeliveryCandidateLog(
  app: FastifyInstance,
  input: BuildNotificationDeliveryLogRecordInput
): Promise<{ created: boolean; idempotencyKey: string }> {
  const record = truncateNotificationDeliveryLogRecord(buildNotificationDeliveryLogRecord(input));

  const inserted = await app.db
    .insert(notificationDeliveryLogs)
    .values({
      profileId: record.profileId,
      kind: record.kind,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      channel: record.channel,
      status: record.status,
      idempotencyKey: record.idempotencyKey,
      dedupKey: record.dedupKey,
      frequencyWindowHours: record.frequencyWindowHours,
      deliveryAllowed: record.deliveryAllowed,
      draftOnly: record.draftOnly,
      blockedReasons: record.blockedReasons,
      metadata: record.metadata
    })
    .onConflictDoNothing({
      target: notificationDeliveryLogs.idempotencyKey
    })
    .returning({
      idempotencyKey: notificationDeliveryLogs.idempotencyKey
    });

  return {
    created: inserted.length > 0,
    idempotencyKey: record.idempotencyKey
  };
}

function sanitizeDeliveryKeyPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_.:-]/gu, "_").slice(0, 160);
}

function sanitizeNotificationDeliveryMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveNotificationDeliveryMetadataKey(key)) {
      continue;
    }

    if (typeof value === "string") {
      safe[key] = value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
        .replace(/\b(?:accessToken|refreshToken|passwordHash|otpCode|authorization|cookie|set-cookie)\b/giu, "[redacted-secret]");
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    }
  }

  return safe;
}

function isSensitiveNotificationDeliveryMetadataKey(key: string): boolean {
  return /email|phone|token|password|cookie|authorization|secret|otp|raw|body/iu.test(key);
}

export const sanitizeNotificationMetadata = sanitizeNotificationDeliveryMetadata;
