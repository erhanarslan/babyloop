import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { adminEmailTestSendBodySchema } from "../schemas/admin-email.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  getAdminEmailOpsPreview,
  AdminEmailOpsError,
  createAdminEmailOpsState,
  sendAdminTestEmail,
  type AdminEmailOpsPreview,
  type AdminEmailTestSendResult
} from "../services/admin-email-ops.service.js";

type AdminEmailOpsPreviewResponse = ApiResponse<AdminEmailOpsPreview>;
type AdminEmailTestSendResponse = ApiResponse<AdminEmailTestSendResult>;
const emailOpsState = createAdminEmailOpsState();

export function registerAdminEmailRoutes(app: FastifyInstance): void {
  app.get<{ Reply: AdminEmailOpsPreviewResponse | ApiFailure }>(
    "/admin/email/ops-preview",
    async (request, reply) => {
      const adminUser = await requireAdminUser(app, request, reply);

      if (!adminUser) {
        return reply;
      }

      return {
        ok: true,
        data: await getAdminEmailOpsPreview(app)
      };
    }
  );

  app.post<{ Body: unknown; Reply: AdminEmailTestSendResponse | ApiFailure }>(
    "/admin/email/test-send",
    async (request, reply) => {
      const adminUser = await requireAdminUser(app, request, reply);

      if (!adminUser) {
        return reply;
      }

      const parsedBody = adminEmailTestSendBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAdminEmailTestSendRequest());
      }

      try {
        return {
          ok: true,
          data: await sendAdminTestEmail(app, parsedBody.data, {
            actorProfileId: adminUser.profile.id,
            state: emailOpsState
          })
        };
      } catch (error) {
        const category = error instanceof AdminEmailOpsError ? error.category : "unknown";
        const statusCode = error instanceof AdminEmailOpsError ? error.statusCode : 503;
        request.log.warn({ category, scope: "admin_email_test_send" }, "admin email test send failed");

        return reply.status(statusCode).send({
          ok: false,
          error: {
            code: `EMAIL_TEST_${category.toUpperCase()}`,
            message: safeEmailErrorMessage(category)
          }
        });
      }
    }
  );
}

function invalidAdminEmailTestSendRequest(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "EMAIL_TEST_INVALID_RECIPIENT",
      message: "Kontrollü e-posta test isteği geçersiz."
    }
  };
}

function safeEmailErrorMessage(category: string): string {
  const messages: Record<string, string> = {
    configuration_missing: "Kontrollü test yapılandırması eksik.",
    invalid_recipient: "Alıcı adresi geçersiz.",
    rate_limited: "Kısa sürede çok fazla test istendi.",
    recipient_not_allowed: "Alıcı kontrollü test listesinde değil.",
    timeout: "E-posta sağlayıcısı zamanında yanıt vermedi."
  };
  return messages[category] ?? "Kontrollü e-posta testi tamamlanamadı.";
}
