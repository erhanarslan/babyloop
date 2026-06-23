import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  getAdminNotificationOpsPreview,
  type AdminNotificationOpsPreview
} from "../services/admin-notification-ops.service.js";

type AdminNotificationOpsPreviewResponse = ApiResponse<AdminNotificationOpsPreview>;

export function registerAdminNotificationRoutes(app: FastifyInstance): void {
  app.get<{ Reply: AdminNotificationOpsPreviewResponse | ApiFailure }>(
    "/admin/notifications/ops-preview",
    async (request, reply) => {
      const adminUser = await requireAdminUser(app, request, reply);

      if (!adminUser) {
        return reply;
      }

      return {
        ok: true,
        data: await getAdminNotificationOpsPreview(app)
      };
    }
  );
}
