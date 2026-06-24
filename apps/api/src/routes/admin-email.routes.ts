import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  getAdminEmailOpsPreview,
  type AdminEmailOpsPreview
} from "../services/admin-email-ops.service.js";

type AdminEmailOpsPreviewResponse = ApiResponse<AdminEmailOpsPreview>;

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
}
