import type { FastifyInstance } from "fastify";
import { getEmailProviderPreview } from "./email-provider.service.js";

export type AdminEmailOpsPreview = {
  emailProvider: ReturnType<typeof getEmailProviderPreview>;
  supportedIntents: Array<
    "email_verification" | "password_reset" | "notification_digest" | "security_alert"
  >;
  warning: string;
};

export async function getAdminEmailOpsPreview(_app: FastifyInstance): Promise<AdminEmailOpsPreview> {
  return {
    emailProvider: getEmailProviderPreview(),
    supportedIntents: [
      "email_verification",
      "password_reset",
      "notification_digest",
      "security_alert"
    ],
    warning:
      "Bu endpoint email secret veya API key döndürmez. Email gönderimi sandbox modundadır ve gerçek mail atmaz."
  };
}
