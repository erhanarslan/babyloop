import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { adminEmailTestSendBodySchema } from "../schemas/admin-email.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  getAdminEmailOpsPreview,
  sendAdminTestEmail,
  type AdminEmailOpsPreview,
  type AdminEmailTestSendResult
} from "../services/admin-email-ops.service.js";

type AdminEmailOpsPreviewResponse = ApiResponse<AdminEmailOpsPreview>;
type AdminEmailTestSendResponse = ApiResponse<AdminEmailTestSendResult>;

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
          data: await sendAdminTestEmail(app, parsedBody.data)
        };
      } catch {
        request.log.warn({ scope: "admin_email_test_send" }, "admin email test send failed");

        return reply.status(503).send({
          ok: false,
          error: {
            code: "EMAIL_TEST_SEND_FAILED",
            message: "Admin email test send failed. Check provider configuration and retry."
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
      code: "INVALID_REQUEST",
      message: "Admin email test send request body is invalid."
    }
  };
}
