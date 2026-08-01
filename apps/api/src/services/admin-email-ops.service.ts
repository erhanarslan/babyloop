import { createHash } from "node:crypto";
import { events } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type { AdminEmailTestSendBody } from "../schemas/admin-email.schemas.js";
import {
  getEmailProviderPreview,
  sendEmailDraft,
  type EmailDraft,
  type EmailIntent,
  type EmailProviderDriver,
  type EmailSendResult
} from "./email-provider.service.js";

const SUPPORTED_EMAIL_INTENTS: EmailIntent[] = [
  "email_verification",
  "password_reset",
  "notification_digest",
  "security_alert"
];
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export type AdminEmailErrorCategory =
  | "provider_rejected"
  | "delivery_disabled"
  | "recipient_not_allowed"
  | "invalid_recipient"
  | "rate_limited"
  | "configuration_missing"
  | "timeout"
  | "unknown";

export type AdminEmailOpsPreview = {
  emailProvider: {
    driver: EmailProviderDriver;
    sendEnabled: boolean;
    fromConfigured: boolean;
    providerConfigured: boolean;
    sandboxOnly: boolean;
    missingConfigurationCount: number;
    senderDomainVerified: boolean | null;
  };
  recipientPolicyConfigured: boolean;
  supportedIntents: EmailIntent[];
  warning: string;
};

export type AdminEmailTestSendResult = {
  intent: EmailIntent;
  status: "accepted" | "not_sent";
  provider: EmailProviderDriver;
  sandboxOnly: boolean;
  deliveryReference: string | null;
  recipientMasked: string;
  occurredAt: string;
  errorCategory: AdminEmailErrorCategory | null;
  message: string;
};

export type AdminEmailOpsState = {
  completed: Map<string, { fingerprint: string; result: AdminEmailTestSendResult }>;
  inFlight: Map<string, { fingerprint: string; promise: Promise<AdminEmailTestSendResult> }>;
  attemptsByActor: Map<string, number[]>;
};

type AdminEmailTestSendOptions = {
  actorProfileId?: string;
  audit?: (input: { eventType: string; metadata: Record<string, unknown> }) => Promise<void>;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  sendDraft?: (draft: EmailDraft) => Promise<EmailSendResult>;
  state?: AdminEmailOpsState;
};

const defaultState = createAdminEmailOpsState();

export class AdminEmailOpsError extends Error {
  constructor(
    public readonly category: AdminEmailErrorCategory,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function createAdminEmailOpsState(): AdminEmailOpsState {
  return { completed: new Map(), inFlight: new Map(), attemptsByActor: new Map() };
}

export async function getAdminEmailOpsPreview(
  _app: FastifyInstance,
  env: NodeJS.ProcessEnv = process.env
): Promise<AdminEmailOpsPreview> {
  const provider = getEmailProviderPreview(env);

  return {
    emailProvider: {
      driver: provider.driver,
      sendEnabled: provider.sendEnabled,
      fromConfigured: provider.fromConfigured,
      providerConfigured: provider.providerConfigured,
      sandboxOnly: provider.sandboxOnly,
      missingConfigurationCount: provider.missing.length,
      // The provider preview cannot prove DNS/domain verification. Do not infer it.
      senderDomainVerified: null
    },
    recipientPolicyConfigured: Boolean(readAllowedRecipient(env)),
    supportedIntents: [...SUPPORTED_EMAIL_INTENTS],
    warning: provider.sendEnabled
      ? "Gerçek gönderim açık. Yalnız izinli operasyon alıcısına kontrollü test gönderilebilir."
      : "Gönderim kapalı; kontrollü test isteği sağlayıcıya iletilmez."
  };
}

export async function sendAdminTestEmail(
  app: FastifyInstance,
  body: AdminEmailTestSendBody,
  options: AdminEmailTestSendOptions = {}
): Promise<AdminEmailTestSendResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const state = options.state ?? defaultState;
  const actor = options.actorProfileId ?? "test-actor";
  const allowedRecipient = readAllowedRecipient(env);

  if (!allowedRecipient) {
    throw new AdminEmailOpsError("configuration_missing", 503, "Kontrollü test alıcısı yapılandırılmamış.");
  }
  if (body.to !== allowedRecipient) {
    throw new AdminEmailOpsError("recipient_not_allowed", 403, "Bu alıcı kontrollü test politikasında izinli değil.");
  }

  const idempotencyKey = hash(`${actor}:${body.idempotencyKey}`);
  const fingerprint = hash(JSON.stringify({ intent: body.intent, note: normalizeOptionalNote(body.note), to: body.to }));
  const completed = state.completed.get(idempotencyKey);
  if (completed) {
    if (completed.fingerprint !== fingerprint) {
      throw new AdminEmailOpsError("invalid_recipient", 409, "Aynı işlem anahtarı farklı bir istek için kullanılamaz.");
    }
    return completed.result;
  }
  const inFlight = state.inFlight.get(idempotencyKey);
  if (inFlight) {
    if (inFlight.fingerprint !== fingerprint) {
      throw new AdminEmailOpsError("invalid_recipient", 409, "Aynı işlem anahtarı farklı bir istek için kullanılamaz.");
    }
    return inFlight.promise;
  }

  enforceRateLimit(state, actor, now().getTime());

  const promise = performSend(app, body, {
    ...options,
    ...(options.actorProfileId ? { actorProfileId: options.actorProfileId } : {}),
    env,
    now
  }).then((result) => {
    state.completed.set(idempotencyKey, { fingerprint, result });
    if (state.completed.size > 200) state.completed.delete(state.completed.keys().next().value as string);
    return result;
  }).finally(() => {
    state.inFlight.delete(idempotencyKey);
  });
  state.inFlight.set(idempotencyKey, { fingerprint, promise });
  return promise;
}

async function performSend(
  app: FastifyInstance,
  body: AdminEmailTestSendBody,
  options: AdminEmailTestSendOptions & { env: NodeJS.ProcessEnv; now: () => Date }
): Promise<AdminEmailTestSendResult> {
  const audit = options.audit ?? createAuditWriter(app, options.actorProfileId);
  await audit({ eventType: "admin_email_test_send_started", metadata: { intent: body.intent } });
  const deliver = options.sendDraft ?? ((draft: EmailDraft) => sendEmailDraft(draft, options.env));
  const occurredAt = options.now();

  try {
    const providerResult = await deliver(buildAdminTestEmailDraft(body));
    const result = mapProviderResult(body, providerResult, occurredAt);
    await writeOutcomeAudit(app, audit, {
      eventType: "admin_email_test_send_completed",
      metadata: { category: result.errorCategory ?? "accepted", intent: body.intent, provider: result.provider }
    });
    return result;
  } catch (error) {
    const category = classifyProviderError(error);
    const provider = getEmailProviderPreview(options.env).driver;
    const result: AdminEmailTestSendResult = {
      deliveryReference: null,
      errorCategory: category,
      intent: body.intent,
      message: categoryMessage(category),
      occurredAt: occurredAt.toISOString(),
      provider,
      recipientMasked: maskEmail(body.to),
      sandboxOnly: !getEmailProviderPreview(options.env).sendEnabled,
      status: "not_sent"
    };
    await writeOutcomeAudit(app, audit, {
      eventType: "admin_email_test_send_failed",
      metadata: { category, intent: body.intent, provider }
    });
    return result;
  }
}

async function writeOutcomeAudit(
  app: FastifyInstance,
  audit: (input: { eventType: string; metadata: Record<string, unknown> }) => Promise<void>,
  input: { eventType: string; metadata: Record<string, unknown> }
): Promise<void> {
  try {
    await audit(input);
  } catch {
    // The durable authorization audit was written before provider execution. Do not
    // turn an outcome-audit failure into a second provider delivery on client retry.
    app.log.error({ eventType: input.eventType }, "Admin email outcome audit write failed.");
  }
}

function mapProviderResult(body: AdminEmailTestSendBody, result: EmailSendResult, occurredAt: Date): AdminEmailTestSendResult {
  if (!result.sent) {
    return {
      deliveryReference: null,
      errorCategory: "delivery_disabled",
      intent: body.intent,
      message: categoryMessage("delivery_disabled"),
      occurredAt: occurredAt.toISOString(),
      provider: result.provider,
      recipientMasked: maskEmail(body.to),
      sandboxOnly: true,
      status: "not_sent"
    };
  }
  return {
    deliveryReference: result.messageId ? maskReference(result.messageId) : null,
    errorCategory: null,
    intent: body.intent,
    message: "Gönderim sağlayıcı tarafından kabul edildi.",
    occurredAt: occurredAt.toISOString(),
    provider: result.provider,
    recipientMasked: maskEmail(body.to),
    sandboxOnly: false,
    status: "accepted"
  };
}

function createAuditWriter(app: FastifyInstance, actorProfileId?: string) {
  return async (input: { eventType: string; metadata: Record<string, unknown> }) => {
    if (!actorProfileId) return;
    await app.db.insert(events).values({
      actorProfileId,
      entityId: actorProfileId,
      entityType: "email_ops",
      eventType: input.eventType,
      metadata: input.metadata
    });
  };
}

function enforceRateLimit(state: AdminEmailOpsState, actor: string, now: number): void {
  const recent = (state.attemptsByActor.get(actor) ?? []).filter((value) => value > now - RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    throw new AdminEmailOpsError("rate_limited", 429, "Kısa sürede çok fazla kontrollü test istendi.");
  }
  state.attemptsByActor.set(actor, [...recent, now]);
}

function readAllowedRecipient(env: NodeJS.ProcessEnv): string | null {
  const value = env.NOTIFICATION_SMOKE_RECIPIENT_EMAIL?.trim().toLowerCase();
  return value && value.includes("@") ? value : null;
}

function buildAdminTestEmailDraft(body: AdminEmailTestSendBody): EmailDraft {
  const note = normalizeOptionalNote(body.note);
  return {
    intent: body.intent,
    subject: `BabyLoop kontrollü e-posta testi - ${body.intent}`,
    text: [
      "BabyLoop kontrollü e-posta testi",
      "",
      `Senaryo: ${body.intent}`,
      "Bu ileti yönetim panelindeki kontrollü teslimat doğrulaması için oluşturuldu.",
      note ? `Not: ${note}` : null,
      "",
      "Bu ileti doğrulama tokenı, sıfırlama tokenı, OTP veya secret içermez.",
      "",
      "BabyLoop"
    ].filter((line): line is string => line !== null).join("\n"),
    to: body.to
  };
}

function normalizeOptionalNote(note: string | undefined): string | null {
  return note?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240) || null;
}

function classifyProviderError(error: unknown): AdminEmailErrorCategory {
  if (error instanceof Error && (error.name === "AbortError" || /timeout|timed out/iu.test(error.message))) return "timeout";
  if (error instanceof Error && /required|configuration|must be/iu.test(error.message)) return "configuration_missing";
  if (error instanceof Error && /resend|smtp|provider|delivery/iu.test(error.message)) return "provider_rejected";
  return "unknown";
}

function categoryMessage(category: AdminEmailErrorCategory): string {
  const messages: Record<AdminEmailErrorCategory, string> = {
    configuration_missing: "Gönderim yapılandırması eksik.",
    delivery_disabled: "Gerçek gönderim operasyon anahtarıyla kapalı.",
    invalid_recipient: "Alıcı adresi geçerli değil.",
    provider_rejected: "Sağlayıcı kontrollü test isteğini reddetti.",
    rate_limited: "Kısa sürede çok fazla test istendi. Daha sonra tekrar dene.",
    recipient_not_allowed: "Alıcı kontrollü test listesinde değil.",
    timeout: "Sağlayıcı zamanında yanıt vermedi.",
    unknown: "Kontrollü test güvenli biçimde tamamlanamadı."
  };
  return messages[category];
}

function maskEmail(value: string): string {
  const [local = "", domain = ""] = value.split("@");
  return `${local.slice(0, 1) || "*"}***@${domain}`;
}

function maskReference(value: string): string {
  return value.length <= 10 ? value : `${value.slice(0, 5)}…${value.slice(-4)}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
