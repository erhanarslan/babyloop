import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  getAdminStorageOpsPreview,
  type AdminStorageOpsPreview
} from "../services/admin-storage-ops.service.js";

type AdminStorageOpsPreviewResponse = ApiResponse<AdminStorageOpsPreview>;

export function registerAdminStorageRoutes(app: FastifyInstance): void {
  app.get<{ Reply: AdminStorageOpsPreviewResponse | ApiFailure }>(
    "/admin/storage/ops-preview",
    async (request, reply) => {
      const adminUser = await requireAdminUser(app, request, reply);

      if (!adminUser) {
        return reply;
      }

      return {
        ok: true,
        data: await getAdminStorageOpsPreview(app)
      };
    }
  );
}
