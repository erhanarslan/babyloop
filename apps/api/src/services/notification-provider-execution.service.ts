import { notificationDeliveryLogs, profiles, users } from "@babyloop/database/schema";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { NotificationPreferenceSource } from "../schemas/notification-preferences.schemas.js";
import { sanitizeNotificationMetadata } from "./notification-delivery-log.service.js";
import { isNotificationPreferenceEnabledForDelivery } from "./notification-preferences.service.js";
import { getNotificationEmailProviderConfig } from "./notification-email-config.service.js";
import {
  listNotificationPushTokensForDelivery,
  revokeNotificationPushTokenById
} from "./notification-push-token-registry.service.js";

export type NotificationProviderName = "resend" | "expo" | "n8n";
export type NotificationProviderExecutionStatus =
  | "sent"
  | "skipped"
  | "failed"
  | "retry_scheduled"
  | "duplicate"
  | "not_found";

export type NotificationProviderExecutionResult = {
  status: NotificationProviderExecutionStatus;
  deliveryLogId: string;
  provider: NotificationProviderName | null;
  retryable: boolean;
  reason:
    | "already_sent"
    | "unsupported_channel"
    | "delivery_disabled"
    | "preference_disabled"
    | "provider_disabled"
    | "recipient_email_unverified"
    | "no_push_token"
    | "push_token_decryption_unavailable"
    | "provider_rejected"
    | "provider_error"
    | null;
};

export type NotificationProviderExecutionOptions = {
  env?: NodeJS.ProcessEnv | undefined;
  fetchImpl?: typeof fetch | undefined;
  now?: Date | undefined;
};

export type ProcessPendingNotificationProviderDeliveriesSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  retryScheduled: number;
  providerCallsAllowed: boolean;
  results: NotificationProviderExecutionResult[];
};

type DeliveryLogRow = typeof notificationDeliveryLogs.$inferSelect & {
  recipientEmail: string | null;
  emailVerifiedAt: Date | null;
};

type ProviderAttemptResult =
  | {
      status: "sent";
      providerMessageId: string | null;
      providerResponseMeta: Record<string, unknown>;
    }
  | {
      status: "failed";
      retryable: boolean;
      errorCode: string;
      errorMessage: string;
      providerResponseMeta?: Record<string, unknown>;
    };

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 3000;

export async function executeNotificationProviderDelivery(
  app: FastifyInstance,
  deliveryLogId: string,
  options: NotificationProviderExecutionOptions = {}
): Promise<NotificationProviderExecutionResult> {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const row = await getDeliveryLogRow(app, deliveryLogId);

  if (!row) {
    return {
      status: "not_found",
      deliveryLogId,
      provider: null,
      retryable: false,
      reason: null
    };
  }

  const provider = resolveProviderForChannel(row.channel);

  if (!provider) {
    await markDeliverySkipped(app, row.id, {
      provider: null,
      reason: "unsupported_channel",
      now
    });

    return result("skipped", row.id, null, false, "unsupported_channel");
  }

  if (row.status === "sent") {
    return result("duplicate", row.id, provider, false, "already_sent");
  }

  if (!row.deliveryAllowed || row.draftOnly) {
    await markDeliverySkipped(app, row.id, {
      provider,
      reason: "delivery_disabled",
      now
    });

    return result("skipped", row.id, provider, false, "delivery_disabled");
  }

  const providerConfig = readProviderConfig(provider, env);

  if (!providerConfig.enabled) {
    await markDeliverySkipped(app, row.id, {
      provider,
      reason: "provider_disabled",
      now
    });

    return result("skipped", row.id, provider, false, "provider_disabled");
  }

  const preferenceEnabled = await isNotificationPreferenceEnabledForDelivery(
    app,
    row.profileId,
    resolvePreferenceSource(row.kind),
    resolvePreferenceChannel(row.channel)
  );

  if (!preferenceEnabled) {
    await markDeliverySkipped(app, row.id, {
      provider,
      reason: "preference_disabled",
      now
    });

    return result("skipped", row.id, provider, false, "preference_disabled");
  }

  if (provider === "resend" && (!row.emailVerifiedAt || !row.recipientEmail)) {
    await markDeliverySkipped(app, row.id, {
      provider,
      reason: "recipient_email_unverified",
      now
    });

    return result("skipped", row.id, provider, false, "recipient_email_unverified");
  }

  const attemptResult = await executeProviderAttempt(app, row, provider, providerConfig, {
    fetchImpl,
    now
  });

  if (attemptResult.status === "sent") {
    await markDeliverySent(app, row.id, {
      provider,
      providerMessageId: attemptResult.providerMessageId,
      providerResponseMeta: attemptResult.providerResponseMeta,
      now
    });

    return result("sent", row.id, provider, false, null);
  }

  const maxRetries = providerConfig.maxRetries;
  const retryable = attemptResult.retryable && row.attemptCount + 1 < maxRetries;

  await markDeliveryFailed(app, row.id, {
    provider,
    retryable,
    now,
    errorCode: attemptResult.errorCode,
    errorMessage: attemptResult.errorMessage,
    providerResponseMeta: attemptResult.providerResponseMeta ?? {},
    attemptCount: row.attemptCount
  });

  return result(
    retryable ? "retry_scheduled" : "failed",
    row.id,
    provider,
    retryable,
    attemptResult.retryable ? "provider_error" : "provider_rejected"
  );
}

export async function processPendingNotificationProviderDeliveries(
  app: FastifyInstance,
  options: NotificationProviderExecutionOptions & { limit?: number } = {}
): Promise<ProcessPendingNotificationProviderDeliveriesSummary> {
  const now = options.now ?? new Date();
  const rows = await app.db
    .select({
      id: notificationDeliveryLogs.id
    })
    .from(notificationDeliveryLogs)
    .where(and(
      or(eq(notificationDeliveryLogs.status, "candidate"), eq(notificationDeliveryLogs.providerStatus, "retry_scheduled")),
      or(isNull(notificationDeliveryLogs.nextAttemptAt), lte(notificationDeliveryLogs.nextAttemptAt, now))
    ))
    .limit(options.limit ?? 50);
  const results: NotificationProviderExecutionResult[] = [];

  for (const row of rows) {
    results.push(await executeNotificationProviderDelivery(app, row.id, {
      env: options.env,
      fetchImpl: options.fetchImpl,
      now
    }));
  }

  return {
    processed: results.length,
    sent: results.filter((item) => item.status === "sent").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    retryScheduled: results.filter((item) => item.status === "retry_scheduled").length,
    providerCallsAllowed: hasAnyProviderEnabled(options.env ?? process.env),
    results
  };
}

function result(
  status: NotificationProviderExecutionStatus,
  deliveryLogId: string,
  provider: NotificationProviderName | null,
  retryable: boolean,
  reason: NotificationProviderExecutionResult["reason"]
): NotificationProviderExecutionResult {
  return {
    status,
    deliveryLogId,
    provider,
    retryable,
    reason
  };
}

async function getDeliveryLogRow(app: FastifyInstance, deliveryLogId: string): Promise<DeliveryLogRow | null> {
  const [row] = await app.db
    .select({
      id: notificationDeliveryLogs.id,
      profileId: notificationDeliveryLogs.profileId,
      kind: notificationDeliveryLogs.kind,
      sourceType: notificationDeliveryLogs.sourceType,
      sourceId: notificationDeliveryLogs.sourceId,
      channel: notificationDeliveryLogs.channel,
      status: notificationDeliveryLogs.status,
      idempotencyKey: notificationDeliveryLogs.idempotencyKey,
      dedupKey: notificationDeliveryLogs.dedupKey,
      frequencyWindowHours: notificationDeliveryLogs.frequencyWindowHours,
      deliveryAllowed: notificationDeliveryLogs.deliveryAllowed,
      draftOnly: notificationDeliveryLogs.draftOnly,
      provider: notificationDeliveryLogs.provider,
      providerStatus: notificationDeliveryLogs.providerStatus,
      providerMessageId: notificationDeliveryLogs.providerMessageId,
      attemptCount: notificationDeliveryLogs.attemptCount,
      lastAttemptAt: notificationDeliveryLogs.lastAttemptAt,
      nextAttemptAt: notificationDeliveryLogs.nextAttemptAt,
      lastErrorCode: notificationDeliveryLogs.lastErrorCode,
      lastErrorMessageRedacted: notificationDeliveryLogs.lastErrorMessageRedacted,
      providerResponseMeta: notificationDeliveryLogs.providerResponseMeta,
      skippedReason: notificationDeliveryLogs.skippedReason,
      blockedReasons: notificationDeliveryLogs.blockedReasons,
      metadata: notificationDeliveryLogs.metadata,
      createdAt: notificationDeliveryLogs.createdAt,
      sentAt: notificationDeliveryLogs.sentAt,
      deliveredAt: notificationDeliveryLogs.deliveredAt,
      failedAt: notificationDeliveryLogs.failedAt,
      recipientEmail: users.email,
      emailVerifiedAt: users.emailVerifiedAt
    })
    .from(notificationDeliveryLogs)
    .innerJoin(profiles, eq(profiles.id, notificationDeliveryLogs.profileId))
    .leftJoin(users, eq(users.id, profiles.userId))
    .where(eq(notificationDeliveryLogs.id, deliveryLogId))
    .limit(1);

  return row ?? null;
}

function resolveProviderForChannel(channel: string): NotificationProviderName | null {
  if (channel === "email") return "resend";
  if (channel === "push") return "expo";
  if (channel === "n8n") return "n8n";
  return null;
}

function resolvePreferenceSource(kind: string): NotificationPreferenceSource {
  if (kind === "child_reminder") return "child_reminder";
  if (kind === "saved_search") return "saved_search";
  if (kind === "child_lifecycle") return "child_lifecycle";
  if (kind === "security") return "security";
  if (kind === "message_received") return "messages";
  if (kind === "listing_favorited") return "listing";
  return "marketplace";
}

function resolvePreferenceChannel(channel: string): "email" | "push" | "n8n" {
  if (channel === "push") return "push";
  if (channel === "n8n") return "n8n";
  return "email";
}

type ProviderConfig = {
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  url?: string | undefined;
  apiKey?: string | undefined;
  fromEmail?: string | undefined;
  fromName?: string | undefined;
  webAppUrl?: string | undefined;
  bearerToken?: string | undefined;
  secret?: string | undefined;
};

function readProviderConfig(provider: NotificationProviderName, env: NodeJS.ProcessEnv): ProviderConfig {
  if (provider === "n8n") {
    return {
      enabled: readBoolean(env.N8N_NOTIFICATION_WEBHOOK_ENABLED) && Boolean(env.N8N_NOTIFICATION_WEBHOOK_URL?.trim()),
      url: env.N8N_NOTIFICATION_WEBHOOK_URL?.trim(),
      bearerToken: env.N8N_NOTIFICATION_WEBHOOK_BEARER_TOKEN?.trim(),
      secret: env.N8N_NOTIFICATION_WEBHOOK_SECRET?.trim(),
      timeoutMs: readPositiveInteger(env.N8N_NOTIFICATION_WEBHOOK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      maxRetries: readPositiveInteger(env.N8N_NOTIFICATION_WEBHOOK_MAX_RETRIES, DEFAULT_MAX_RETRIES)
    };
  }

  if (provider === "resend") {
    const emailConfig = getNotificationEmailProviderConfig(env);

    return {
      enabled: emailConfig.enabled,
      url: (env.RESEND_API_BASE_URL?.trim() || "https://api.resend.com").replace(/\/+$/u, ""),
      apiKey: emailConfig.apiKey,
      fromEmail: emailConfig.fromEmail,
      fromName: emailConfig.fromName,
      webAppUrl: (env.WEB_APP_URL ?? env.NEXT_PUBLIC_SITE_URL)?.trim(),
      timeoutMs: readPositiveInteger(env.NOTIFICATION_EMAIL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      maxRetries: readPositiveInteger(env.NOTIFICATION_EMAIL_MAX_RETRIES, DEFAULT_MAX_RETRIES)
    };
  }

  return {
    enabled:
      readBoolean(env.NOTIFICATION_PUSH_ENABLED) &&
      (env.PUSH_PROVIDER ?? "expo").trim().toLowerCase() === "expo" &&
      Boolean(env.EXPO_ACCESS_TOKEN?.trim()),
    url: (env.EXPO_PUSH_API_BASE_URL?.trim() || "https://exp.host/--/api/v2/push/send").replace(/\/+$/u, ""),
    apiKey: env.EXPO_ACCESS_TOKEN?.trim(),
    timeoutMs: readPositiveInteger(env.NOTIFICATION_PUSH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: readPositiveInteger(env.NOTIFICATION_PUSH_MAX_RETRIES, DEFAULT_MAX_RETRIES)
  };
}

function hasAnyProviderEnabled(env: NodeJS.ProcessEnv): boolean {
  return (
    readProviderConfig("n8n", env).enabled ||
    readProviderConfig("resend", env).enabled ||
    readProviderConfig("expo", env).enabled
  );
}

async function executeProviderAttempt(
  app: FastifyInstance,
  row: DeliveryLogRow,
  provider: NotificationProviderName,
  config: ProviderConfig,
  options: {
    fetchImpl: typeof fetch;
    now: Date;
  }
): Promise<ProviderAttemptResult> {
  if (provider === "n8n") {
    return executeN8nWebhook(row, config, options);
  }

  if (provider === "resend") {
    return executeResendEmail(row, config, options);
  }

  return executeExpoPush(app, row, config, options);
}

async function executeN8nWebhook(
  row: DeliveryLogRow,
  config: ProviderConfig,
  options: { fetchImpl: typeof fetch; now: Date }
): Promise<ProviderAttemptResult> {
  const response = await fetchJson(config.url!, {
    fetchImpl: options.fetchImpl,
    timeoutMs: config.timeoutMs,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": row.idempotencyKey,
      ...(config.bearerToken ? { authorization: `Bearer ${config.bearerToken}` } : {}),
      ...(config.secret ? { "x-babyloop-webhook-secret": config.secret } : {})
    },
    body: JSON.stringify(buildProviderPayload(row, options.now))
  });

  return toProviderAttemptResult(response, "n8n");
}

async function executeResendEmail(
  row: DeliveryLogRow,
  config: ProviderConfig,
  options: { fetchImpl: typeof fetch; now: Date }
): Promise<ProviderAttemptResult> {
  const safeSubject = buildNotificationSubject(row);
  const safeText = buildNotificationText(row, config.webAppUrl);
  const response = await fetchJson(`${config.url}/emails`, {
    fetchImpl: options.fetchImpl,
    timeoutMs: config.timeoutMs,
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": row.idempotencyKey
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [row.recipientEmail ?? ""],
      subject: safeSubject,
      text: safeText,
      html: `<p>${escapeHtml(safeText)}</p>`,
      tags: [
        { name: "source", value: row.kind },
        { name: "channel", value: row.channel }
      ]
    })
  });

  return toProviderAttemptResult(response, "resend");
}

async function executeExpoPush(
  app: FastifyInstance,
  row: DeliveryLogRow,
  config: ProviderConfig,
  options: { fetchImpl: typeof fetch; now: Date }
): Promise<ProviderAttemptResult> {
  const tokens = await listNotificationPushTokensForDelivery(app, row.profileId);

  if (tokens.length === 0) {
    return {
      status: "failed",
      retryable: false,
      errorCode: "no_push_token",
      errorMessage: "No active decryptable push token is available."
    };
  }

  const body = tokens.map((token) => ({
    to: token.token,
    title: buildNotificationSubject(row),
    body: buildNotificationText(row),
    data: buildPushData(row),
    sound: "default"
  }));
  const response = await fetchJson(config.url!, {
    fetchImpl: options.fetchImpl,
    timeoutMs: config.timeoutMs,
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      "x-idempotency-key": row.idempotencyKey
    },
    body: JSON.stringify(body)
  });

  if (response.ok && Array.isArray(response.json?.data)) {
    const invalidTokenIndexes = response.json.data
      .map((ticket: { status?: string; details?: { error?: string } }, index: number) => (
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? index : -1
      ))
      .filter((index: number) => index >= 0);

    for (const index of invalidTokenIndexes) {
      const token = tokens[index];

      if (token) {
        await revokeNotificationPushTokenById(app, row.profileId, token.id);
      }
    }
  }

  return toProviderAttemptResult(response, "expo");
}

type FetchJsonResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown> | null;
  text: string;
  retryable: boolean;
};

async function fetchJson(
  url: string,
  input: {
    fetchImpl: typeof fetch;
    timeoutMs: number;
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchImpl(url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
      signal: controller.signal
    });
    const text = await response.text();
    const json = parseJsonObject(text);

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
      retryable: response.status === 429 || response.status >= 500
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: sanitizeErrorMessage(error),
      retryable: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toProviderAttemptResult(response: FetchJsonResult, provider: NotificationProviderName): ProviderAttemptResult {
  if (response.ok) {
    return {
      status: "sent",
      providerMessageId: extractProviderMessageId(response.json, provider),
      providerResponseMeta: sanitizeProviderResponseMeta(response.json, response.status)
    };
  }

  return {
    status: "failed",
    retryable: response.retryable,
    errorCode: response.status > 0 ? `${provider}_${response.status}` : `${provider}_network_error`,
    errorMessage: sanitizeErrorMessage(response.text),
    providerResponseMeta: sanitizeProviderResponseMeta(response.json, response.status)
  };
}

function extractProviderMessageId(json: Record<string, unknown> | null, provider: NotificationProviderName): string | null {
  if (!json) return null;

  if (provider === "resend" && typeof json.id === "string") {
    return json.id.slice(0, 160);
  }

  if (provider === "expo" && Array.isArray(json.data)) {
    const firstTicket = json.data.find((ticket): ticket is { id: string } => (
      Boolean(ticket) && typeof ticket === "object" && "id" in ticket && typeof ticket.id === "string"
    ));

    return firstTicket?.id.slice(0, 160) ?? null;
  }

  if (typeof json.id === "string") {
    return json.id.slice(0, 160);
  }

  return null;
}

function buildProviderPayload(row: DeliveryLogRow, now: Date): Record<string, unknown> {
  const metadata = sanitizeNotificationMetadata(row.metadata);

  return {
    eventType: "notification.delivery",
    source: row.kind,
    channel: row.channel,
    provider: resolveProviderForChannel(row.channel),
    deliveryLogId: row.id,
    idempotencyKey: row.idempotencyKey,
    profileId: row.profileId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    childProfileId: readString(metadata.childProfileId),
    reminderId: readString(metadata.reminderId),
    scheduleKind: readString(metadata.scheduleKind),
    dueAt: readString(metadata.remindAt),
    safeTitle: buildNotificationSubject(row),
    createdAt: row.createdAt.toISOString(),
    attemptedAt: now.toISOString()
  };
}

function buildPushData(row: DeliveryLogRow): Record<string, unknown> {
  if (row.kind === "security") {
    return {
      source: row.kind,
      deliveryLogId: row.id,
      entityType: "login_approval",
      entityId: row.sourceId
    };
  }

  const metadata = row.metadata ?? {};

  return {
    source: row.kind,
    deliveryLogId: row.id,
    childProfileId: readString(metadata.childProfileId),
    reminderId: readString(metadata.reminderId),
    savedSearchId: readString(metadata.savedSearchId),
    categoryId: readString(metadata.categoryId),
    actionHref: readString(metadata.actionHref)
  };
}

function buildNotificationSubject(row: DeliveryLogRow): string {
  if (row.kind === "security") {
    return "BabyLoop güvenlik onayı";
  }

  if (row.kind === "child_reminder") {
    return "BabyLoop hatırlatması";
  }

  if (row.kind === "saved_search") {
    return "BabyLoop arama bildirimi";
  }

  if (row.kind === "child_lifecycle") {
    return "BabyLoop yaşa göre öneri";
  }

  if (row.kind === "message_received") {
    return "BabyLoop'ta yeni mesajın var";
  }

  if (row.kind === "listing_favorited") {
    return "İlanın BabyLoop'ta favoriye eklendi";
  }

  return "BabyLoop bildirimi";
}

function buildNotificationText(row: DeliveryLogRow, webAppUrl?: string): string {
  const metadata = row.metadata ?? {};
  let message: string;

  if (row.kind === "security") {
    message = `${readString(metadata.deviceLabel) ?? "Yeni web girişi"} için mobil onay gerekiyor. Bu işlemi siz başlatmadıysanız reddedin.`;
  } else if (row.kind === "child_reminder") {
    message = `${readString(metadata.reminderTitle) ?? "Hatırlatma"} için bildirim zamanı geldi.`;
  } else if (row.kind === "saved_search") {
    message = `${readString(metadata.savedSearchTitle) ?? "Kayıtlı aramanız"} için yeni eşleşmeler olabilir.`;
  } else if (row.kind === "child_lifecycle") {
    message = `${readString(metadata.categoryName) ?? "Yaşa uygun ürün"} önerisi hazır.`;
  } else if (row.kind === "message_received") {
    const sender = readString(metadata.senderDisplayName) ?? "Bir BabyLoop kullanıcısı";
    const listingTitle = readString(metadata.listingTitle);
    message = listingTitle
      ? `${sender}, “${listingTitle}” ilanı hakkında sana yeni bir mesaj gönderdi.`
      : `${sender} sana yeni bir mesaj gönderdi.`;
  } else if (row.kind === "listing_favorited") {
    const listingTitle = readString(metadata.listingTitle) ?? "İlanın";
    message = `“${listingTitle}” bir BabyLoop kullanıcısı tarafından favoriye eklendi.`;
  } else {
    message = "BabyLoop bildiriminiz var.";
  }

  const actionUrl = buildNotificationActionUrl(metadata.actionHref, webAppUrl);

  return actionUrl ? `${message}\n\nGörüntüle: ${actionUrl}` : message;
}

function buildNotificationActionUrl(actionHref: unknown, webAppUrl?: string): string | null {
  const safePath = readString(actionHref);

  if (!safePath?.startsWith("/") || safePath.startsWith("//") || !webAppUrl) {
    return null;
  }

  try {
    const baseUrl = new URL(webAppUrl);

    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      return null;
    }

    return new URL(safePath, baseUrl).toString();
  } catch {
    return null;
  }
}

function sanitizeNotificationText(value: string, maxLength: number): string {
  return value
    .replace(/[<>{}]/gu, "")
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const safeValue = sanitizeNotificationText(value, 160);

  return safeValue.length > 0 ? safeValue : null;
}

function sanitizeProviderResponseMeta(json: Record<string, unknown> | null, status: number): Record<string, unknown> {
  const meta = sanitizeNotificationMetadata({
    status,
    id: typeof json?.id === "string" ? json.id : null,
    name: typeof json?.name === "string" ? json.name : null,
    message: typeof json?.message === "string" ? sanitizeErrorMessage(json.message) : null
  });

  if (Array.isArray(json?.data)) {
    meta.ticketCount = json.data.length;
  }

  return meta;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/\b(?:accessToken|refreshToken|passwordHash|authorization|cookie|set-cookie|api[_-]?key|secret|token)\b[^\s,;]*/giu, "[redacted-secret]")
    .slice(0, 240);
}

async function markDeliverySkipped(
  app: FastifyInstance,
  deliveryLogId: string,
  input: {
    provider: NotificationProviderName | null;
    reason: NonNullable<NotificationProviderExecutionResult["reason"]>;
    now: Date;
  }
): Promise<void> {
  await app.db
    .update(notificationDeliveryLogs)
    .set({
      status: "skipped",
      provider: input.provider,
      providerStatus: "skipped",
      skippedReason: input.reason,
      nextAttemptAt: null,
      lastAttemptAt: input.now,
      lastErrorCode: null,
      lastErrorMessageRedacted: null,
      providerResponseMeta: {},
      metadata: sanitizeNotificationMetadata((await getDeliveryLogMetadata(app, deliveryLogId)) ?? {})
    })
    .where(eq(notificationDeliveryLogs.id, deliveryLogId));
}

async function markDeliverySent(
  app: FastifyInstance,
  deliveryLogId: string,
  input: {
    provider: NotificationProviderName;
    providerMessageId: string | null;
    providerResponseMeta: Record<string, unknown>;
    now: Date;
  }
): Promise<void> {
  await app.db
    .update(notificationDeliveryLogs)
    .set({
      status: "sent",
      provider: input.provider,
      providerStatus: "sent",
      providerMessageId: input.providerMessageId,
      attemptCount: sql`${notificationDeliveryLogs.attemptCount} + 1`,
      lastAttemptAt: input.now,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessageRedacted: null,
      providerResponseMeta: input.providerResponseMeta,
      metadata: sanitizeNotificationMetadata((await getDeliveryLogMetadata(app, deliveryLogId)) ?? {}),
      deliveryAllowed: true,
      draftOnly: false,
      sentAt: input.now,
      deliveredAt: input.now,
      failedAt: null,
      skippedReason: null
    })
    .where(and(eq(notificationDeliveryLogs.id, deliveryLogId), sql`${notificationDeliveryLogs.status} <> 'sent'`));
}

async function markDeliveryFailed(
  app: FastifyInstance,
  deliveryLogId: string,
  input: {
    provider: NotificationProviderName;
    retryable: boolean;
    now: Date;
    errorCode: string;
    errorMessage: string;
    providerResponseMeta: Record<string, unknown>;
    attemptCount: number;
  }
): Promise<void> {
  await app.db
    .update(notificationDeliveryLogs)
    .set({
      status: "failed",
      provider: input.provider,
      providerStatus: input.retryable ? "retry_scheduled" : "failed",
      attemptCount: sql`${notificationDeliveryLogs.attemptCount} + 1`,
      lastAttemptAt: input.now,
      nextAttemptAt: input.retryable ? buildNextAttemptAt(input.now, input.attemptCount + 1) : null,
      lastErrorCode: input.errorCode.slice(0, 80),
      lastErrorMessageRedacted: sanitizeErrorMessage(input.errorMessage),
      providerResponseMeta: input.providerResponseMeta,
      metadata: sanitizeNotificationMetadata((await getDeliveryLogMetadata(app, deliveryLogId)) ?? {}),
      failedAt: input.retryable ? null : input.now,
      skippedReason: null
    })
    .where(eq(notificationDeliveryLogs.id, deliveryLogId));
}

async function getDeliveryLogMetadata(
  app: FastifyInstance,
  deliveryLogId: string
): Promise<Record<string, unknown> | null> {
  const [row] = await app.db
    .select({
      metadata: notificationDeliveryLogs.metadata
    })
    .from(notificationDeliveryLogs)
    .where(eq(notificationDeliveryLogs.id, deliveryLogId))
    .limit(1);

  return row?.metadata ?? null;
}

function buildNextAttemptAt(now: Date, attemptCount: number): Date {
  const retryDelayMs = Math.min(60, 2 ** Math.max(0, attemptCount - 1) * 5) * 60 * 1000;
  return new Date(now.getTime() + retryDelayMs);
}

function readBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
