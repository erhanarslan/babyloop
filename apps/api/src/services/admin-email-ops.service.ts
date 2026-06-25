import type { FastifyInstance } from "fastify";
import type { AdminEmailTestSendBody } from "../schemas/admin-email.schemas.js";
import {
  getEmailProviderPreview,
  sendEmailDraft,
  type EmailDraft,
  type EmailIntent,
  type EmailSendResult
} from "./email-provider.service.js";

type EmailProviderPreview = ReturnType<typeof getEmailProviderPreview>;

const SUPPORTED_EMAIL_INTENTS: EmailIntent[] = [
  "email_verification",
  "password_reset",
  "notification_digest",
  "security_alert"
];

export type AdminEmailOpsPreview = {
  emailProvider: EmailProviderPreview;
  supportedIntents: EmailIntent[];
  warning: string;
};

export type AdminEmailTestSendResult = {
  intent: EmailIntent;
  result: EmailSendResult;
  warning: string;
};

type AdminEmailTestSendOptions = {
  env?: NodeJS.ProcessEnv;
  sendDraft?: (draft: EmailDraft) => Promise<EmailSendResult>;
};

export async function getAdminEmailOpsPreview(
  _app: FastifyInstance,
  env: NodeJS.ProcessEnv = process.env
): Promise<AdminEmailOpsPreview> {
  const emailProvider = getEmailProviderPreview(env);

  return {
    emailProvider,
    supportedIntents: [...SUPPORTED_EMAIL_INTENTS],
    warning: buildEmailOpsWarning(emailProvider)
  };
}

export async function sendAdminTestEmail(
  _app: FastifyInstance,
  body: AdminEmailTestSendBody,
  options: AdminEmailTestSendOptions = {}
): Promise<AdminEmailTestSendResult> {
  const draft = buildAdminTestEmailDraft(body);
  const deliver =
    options.sendDraft ??
    ((emailDraft: EmailDraft) => sendEmailDraft(emailDraft, options.env ?? process.env));
  const result = await deliver(draft);

  return {
    intent: body.intent,
    result,
    warning: result.sent
      ? "Admin test email gönderimi provider tarafından kabul edildi."
      : "Admin test email sandbox/disabled modda kaldı; gerçek mail gönderilmedi."
  };
}

function buildEmailOpsWarning(emailProvider: EmailProviderPreview): string {
  if (emailProvider.sendEnabled) {
    return [
      "Email gerçek gönderim modu aktiftir.",
      "Bu endpoint SMTP şifresi, SMTP kullanıcısı, Resend API key, verification token, reset token veya auth/session datası döndürmez."
    ].join(" ");
  }

  return [
    "Email provider sandbox modundadır.",
    "EMAIL_SEND_ENABLED=true yapılmadıkça gerçek email gönderilmez.",
    "Bu endpoint secret veya raw token döndürmez."
  ].join(" ");
}

function buildAdminTestEmailDraft(body: AdminEmailTestSendBody): EmailDraft {
  const note = normalizeOptionalNote(body.note);

  return {
    intent: body.intent,
    to: body.to,
    subject: `BabyLoop admin test email - ${body.intent}`,
    text: [
      "BabyLoop admin test email",
      "",
      `Intent: ${body.intent}`,
      "Bu mesaj admin email delivery smoke test için oluşturuldu.",
      note ? `Not: ${note}` : null,
      "",
      "Bu email verification token, reset token, OTP veya secret içermez.",
      "",
      "BabyLoop"
    ]
      .filter((line): line is string => line !== null)
      .join("\n")
  };
}

function normalizeOptionalNote(note: string | undefined): string | null {
  const normalized = note
    ?.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized && normalized.length > 0 ? normalized.slice(0, 240) : null;
}
