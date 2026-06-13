import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type { AdminDashboardSummaryResponse } from "../schemas/admin-dashboard.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import { getAdminDashboardSummary } from "../services/admin-dashboard.service.js";

type AdminDashboardSummaryApiResponse = ApiResponse<{
  summary: AdminDashboardSummaryResponse;
}>;

export function registerAdminDashboardRoutes(app: FastifyInstance): void {
  app.get<{ Reply: AdminDashboardSummaryApiResponse }>(
    "/admin/dashboard/summary",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          summary: await getAdminDashboardSummary(app)
        }
      };
    }
  );
}
