import { notificationDeliveryLogs } from "@babyloop/database/schema";
import { desc, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  getNotificationDeliveryPolicyPreview,
  type NotificationDeliveryCandidateKind,
  type NotificationDeliveryChannel
} from "./notification-delivery-policy.service.js";
import type { NotificationDeliveryLogStatus } from "./notification-delivery-log.service.js";

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
  sourceType: "child_profile" | "saved_search" | "unknown";
  sourceRef: string;
  channel: NotificationDeliveryChannel | "email" | "push" | "n8n" | "unknown";
  status: NotificationDeliveryLogStatus | "unknown";
  deliveryAllowed: false;
  draftOnly: true;
  blockedReasons: string[];
  frequencyWindowHours: number;
  createdAt: string;
};

type CountRow<T extends string> = {
  key: T | null;
  count: number;
};

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
      deliveryAllowed: false,
      draftOnly: true,
      blockedReasons: sanitizeBlockedReasons(row.blockedReasons),
      frequencyWindowHours: row.frequencyWindowHours,
      createdAt: row.createdAt.toISOString()
    })),
    privacyNote:
      "Preview yalnızca aggregate count ve redacted sourceRef döndürür; metadata, idempotency key, dedup key, e-mail, token, cookie, authorization veya raw body göstermez."
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
  if (value === "child_lifecycle" || value === "saved_search" || value === "child_reminder") {
    return value;
  }

  return "unknown";
}

function normalizeSourceType(value: string): "child_profile" | "saved_search" | "unknown" {
  if (value === "child_profile" || value === "saved_search") {
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
