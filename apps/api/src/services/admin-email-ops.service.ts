import type { FastifyInstance } from "fastify";
import {
  getEmailProviderPreview,
  type EmailIntent
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
