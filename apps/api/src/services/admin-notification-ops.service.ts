import { notificationDeliveryLogs } from "@babyloop/database/schema";
import { desc, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  getNotificationDeliveryPolicyPreview,
  type NotificationDeliveryCandidateKind,
  type NotificationDeliveryChannel
} from "./notification-delivery-policy.service.js";
import type { NotificationDeliveryLogStatus } from "./notification-delivery-log.service.js";
import {
  getNotificationDeliveryTransitionPreview,
  type NotificationDeliveryTransitionPreview
} from "./notification-delivery-transitions.service.js";
import {
  getNotificationPushReadinessPreview,
  type NotificationPushReadinessPreview
} from "./notification-push-readiness.service.js";
import {
  getNotificationN8nReadinessPreview,
  type NotificationN8nReadinessPreview
} from "./notification-n8n-readiness.service.js";
import {
  getNotificationPreferenceSummary,
  type NotificationPreferencesSummary
} from "./notification-preferences.service.js";
// Notification delivery transition preview must expose allowedDraftOnlyTransitions and futureSenderTransitions
// through admin ops without enabling provider senders.

export type AdminNotificationOpsPreview = {
  summary: {
    status: "draft_only";
    draftOnly: true;
  };
  deliveryPolicy: {
    sendEnabled: false;
    queueEnabled: false;
    emailEnabled: false;
    pushEnabled: false;
    n8nEnabled: false;
    dedupRequired: true;
    frequencyLimitRequired: true;
  };
  channels: Array<{
    key: "in_app" | "email_draft" | "push_future" | "n8n_future";
    label: string;
    status: "draft_only" | "future";
    note: string;
  }>;
  nextSteps: string[];
  policyPreview: ReturnType<typeof getNotificationDeliveryPolicyPreview>;
  transitionPreview: NotificationDeliveryTransitionPreview;
  pushReadinessPreview: NotificationPushReadinessPreview;
  n8nReadinessPreview: NotificationN8nReadinessPreview;
  preferenceSummary: NotificationPreferencesSummary;
  deliveryLogPreview: AdminNotificationDeliveryLogPreview;
  warning: string;
};

export type AdminNotificationDeliveryLogPreview = {
  enabled: true;
  draftOnly: true;
  totals: {
    all: number;
    candidate: number;
    blocked: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  byKind: Array<{
    kind: NotificationDeliveryCandidateKind | "unknown";
    count: number;
  }>;
  byChannel: Array<{
    channel: NotificationDeliveryChannel | "email" | "push" | "n8n" | "unknown";
    count: number;
  }>;
  byStatus: Array<{
    status: NotificationDeliveryLogStatus | "unknown";
    count: number;
  }>;
  recent: AdminNotificationDeliveryLogPreviewItem[];
  privacyNote: string;
};

export type AdminNotificationDeliveryLogPreviewItem = {
  kind: NotificationDeliveryCandidateKind | "unknown";
  sourceType: "child_profile" | "saved_search" | "login_approval" | "unknown";
  sourceRef: string;
  channel: NotificationDeliveryChannel | "email" | "push" | "n8n" | "unknown";
  status: NotificationDeliveryLogStatus | "unknown";
  provider: "resend" | "expo" | "n8n" | "none" | "unknown";
  providerStatus: string | null;
  providerMessageRef: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessageRedacted: string | null;
  skippedReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  deliveryAllowed: boolean;
  draftOnly: boolean;
  blockedReasons: string[];
  frequencyWindowHours: number;
  createdAt: string;
};

type CountRow<T extends string> = {
  key: T | null;
  count: number;
};

// n8n workflow readiness source-token boundary: n8nWorkflowEnabled stays false via n8nReadinessPreview.
// Native push readiness is exposed as blocked/draft-only ops metadata.
// Native push readiness source-token boundary: pushSenderEnabled stays false via pushReadinessPreview.
export async function getAdminNotificationOpsPreview(app: FastifyInstance): Promise<AdminNotificationOpsPreview> {
  return {
    summary: {
      status: "draft_only",
      draftOnly: true
    },
    deliveryPolicy: {
      sendEnabled: false,
      queueEnabled: false,
      emailEnabled: false,
      pushEnabled: false,
      n8nEnabled: false,
      dedupRequired: true,
      frequencyLimitRequired: true
    },
    channels: [
      {
        key: "in_app",
        label: "In-app",
        status: "draft_only",
        note: "Uygulama içi notification adayları delivery log ile izlenebilir; bu preview gönderim yapmaz."
      },
      {
        key: "email_draft",
        label: "Email draft",
        status: "draft_only",
        note: "Email taslağı adayı üretilebilir; provider gönderimi kapalıdır."
      },
      {
        key: "push_future",
        label: "Push",
        status: "future",
        note: "Native push token, consent ve provider geçişleri ayrı paket olarak kalır."
      },
      {
        key: "n8n_future",
        label: "n8n hook",
        status: "future",
        note: "Webhook yalnızca delivery log + retry + idempotency sonrası açılmalı. Admin audit ayrıca zorunludur."
      }
    ],
    nextSteps: [
      "delivery log transition modeli: candidate/blocked/sent/failed/skipped",
      "notification_delivery_logs schema ve admin audit bağlantısı",
      "sender provider sandbox",
      "retry ve dead-letter policy",
      "n8n webhook idempotency token"
    ],
    policyPreview: getNotificationDeliveryPolicyPreview(),
    transitionPreview: getNotificationDeliveryTransitionPreview(),
    pushReadinessPreview: getNotificationPushReadinessPreview(),
    n8nReadinessPreview: getNotificationN8nReadinessPreview(),
    preferenceSummary: getNotificationPreferenceSummary(),
    deliveryLogPreview: await getAdminNotificationDeliveryLogPreview(app),
    warning:
      "Bu endpoint operasyonel önizlemedir. Email, push, n8n, queue veya in-app notification gönderimi yapmaz."
  };
}

export async function getAdminNotificationDeliveryLogPreview(
  app: FastifyInstance
): Promise<AdminNotificationDeliveryLogPreview> {
  const [totalRows, statusRows, kindRows, channelRows, recentRows] = await Promise.all([
    app.db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(notificationDeliveryLogs),
    app.db
      .select({
        key: notificationDeliveryLogs.status,
        count: sql<number>`count(*)::int`
      })
      .from(notificationDeliveryLogs)
      .groupBy(notificationDeliveryLogs.status),
    app.db
      .select({
        key: notificationDeliveryLogs.kind,
        count: sql<number>`count(*)::int`
      })
      .from(notificationDeliveryLogs)
      .groupBy(notificationDeliveryLogs.kind),
    app.db
      .select({
        key: notificationDeliveryLogs.channel,
        count: sql<number>`count(*)::int`
      })
      .from(notificationDeliveryLogs)
      .groupBy(notificationDeliveryLogs.channel),
    app.db
      .select({
        kind: notificationDeliveryLogs.kind,
        sourceType: notificationDeliveryLogs.sourceType,
        sourceId: notificationDeliveryLogs.sourceId,
        channel: notificationDeliveryLogs.channel,
        status: notificationDeliveryLogs.status,
        provider: notificationDeliveryLogs.provider,
        providerStatus: notificationDeliveryLogs.providerStatus,
        providerMessageId: notificationDeliveryLogs.providerMessageId,
        attemptCount: notificationDeliveryLogs.attemptCount,
        lastAttemptAt: notificationDeliveryLogs.lastAttemptAt,
        nextAttemptAt: notificationDeliveryLogs.nextAttemptAt,
        lastErrorCode: notificationDeliveryLogs.lastErrorCode,
        lastErrorMessageRedacted: notificationDeliveryLogs.lastErrorMessageRedacted,
        skippedReason: notificationDeliveryLogs.skippedReason,
        sentAt: notificationDeliveryLogs.sentAt,
        deliveredAt: notificationDeliveryLogs.deliveredAt,
        failedAt: notificationDeliveryLogs.failedAt,
        deliveryAllowed: notificationDeliveryLogs.deliveryAllowed,
        draftOnly: notificationDeliveryLogs.draftOnly,
        blockedReasons: notificationDeliveryLogs.blockedReasons,
        frequencyWindowHours: notificationDeliveryLogs.frequencyWindowHours,
        createdAt: notificationDeliveryLogs.createdAt
      })
      .from(notificationDeliveryLogs)
      .orderBy(desc(notificationDeliveryLogs.createdAt))
      .limit(10)
  ]);

  const byStatus = buildCountList(statusRows).map((row) => ({
    status: normalizeStatus(row.key),
    count: row.count
  }));
  const totalByStatus = new Map(byStatus.map((item) => [item.status, item.count]));

  return {
    enabled: true,
    draftOnly: true,
    totals: {
      all: totalRows[0]?.count ?? 0,
      candidate: totalByStatus.get("candidate") ?? 0,
      blocked: totalByStatus.get("blocked") ?? 0,
      sent: totalByStatus.get("sent") ?? 0,
      failed: totalByStatus.get("failed") ?? 0,
      skipped: totalByStatus.get("skipped") ?? 0
    },
    byKind: buildCountList(kindRows).map((row) => ({
      kind: row.key as NotificationDeliveryCandidateKind | "unknown",
      count: row.count
    })),
    byChannel: buildCountList(channelRows).map((row) => ({
      channel: row.key as NotificationDeliveryChannel | "email" | "push" | "n8n" | "unknown",
      count: row.count
    })),
    byStatus,
    recent: recentRows.map((row) => ({
      kind: normalizeKind(row.kind),
      sourceType: normalizeSourceType(row.sourceType),
      sourceRef: maskSourceRef(row.sourceId),
      channel: normalizeChannel(row.channel),
      status: normalizeStatus(row.status),
      provider: normalizeProvider(row.provider),
      providerStatus: sanitizeShortText(row.providerStatus),
      providerMessageRef: row.providerMessageId ? maskSourceRef(row.providerMessageId) : null,
      attemptCount: row.attemptCount,
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
      lastErrorCode: sanitizeShortText(row.lastErrorCode),
      lastErrorMessageRedacted: sanitizeShortText(row.lastErrorMessageRedacted),
      skippedReason: sanitizeShortText(row.skippedReason),
      sentAt: row.sentAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      deliveryAllowed: row.deliveryAllowed,
      draftOnly: row.draftOnly,
      blockedReasons: sanitizeBlockedReasons(row.blockedReasons),
      frequencyWindowHours: row.frequencyWindowHours,
      createdAt: row.createdAt.toISOString()
    })),
    privacyNote:
      "Preview yalnızca aggregate count, provider status ve redacted source/message ref döndürür; metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, provider secret veya raw body göstermez."
  };
}

function buildCountList<T extends string>(rows: CountRow<T>[]): Array<{ key: T | "unknown"; count: number }> {
  return rows
    .map((row): { key: T | "unknown"; count: number } => ({
      key: row.key ?? "unknown",
      count: Number(row.count) || 0
    }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function normalizeKind(value: string): NotificationDeliveryCandidateKind | "unknown" {
  if (value === "child_lifecycle" || value === "saved_search" || value === "child_reminder" || value === "security") {
    return value;
  }

  return "unknown";
}

function normalizeSourceType(value: string): "child_profile" | "saved_search" | "login_approval" | "unknown" {
  if (value === "child_profile" || value === "saved_search" || value === "login_approval") {
    return value;
  }

  return "unknown";
}

function normalizeChannel(value: string): NotificationDeliveryChannel | "email" | "push" | "n8n" | "unknown" {
  if (value === "in_app" || value === "email_draft" || value === "email" || value === "push" || value === "n8n") {
    return value;
  }

  return "unknown";
}

function normalizeStatus(value: string): NotificationDeliveryLogStatus | "unknown" {
  if (value === "candidate" || value === "blocked" || value === "sent" || value === "failed" || value === "skipped") {
    return value;
  }

  return "unknown";
}

function normalizeProvider(value: string | null): AdminNotificationDeliveryLogPreviewItem["provider"] {
  if (!value) {
    return "none";
  }

  if (value === "resend" || value === "expo" || value === "n8n") {
    return value;
  }

  return "unknown";
}

function sanitizeShortText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/\b(?:accessToken|refreshToken|passwordHash|authorization|cookie|set-cookie|api[_-]?key|secret|token)\b[^\s,;]*/giu, "[redacted-secret]")
    .slice(0, 120);
}

function sanitizeBlockedReasons(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/[^a-z0-9_:-]/giu, "_").slice(0, 80))
    .slice(0, 8);
}

function maskSourceRef(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_.:-]/gu, "_");

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 6)}…${normalized.slice(-6)}`;
}
