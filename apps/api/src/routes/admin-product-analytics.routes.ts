import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type { AdminProductAnalyticsSummaryResponse } from "../schemas/admin-product-analytics.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import { getAdminProductAnalyticsSummary } from "../services/admin-product-analytics.service.js";

type AdminProductAnalyticsSummaryApiResponse = ApiResponse<{
  summary: AdminProductAnalyticsSummaryResponse;
}>;

export function registerAdminProductAnalyticsRoutes(app: FastifyInstance): void {
  app.get<{ Reply: AdminProductAnalyticsSummaryApiResponse }>(
    "/admin/product-analytics/summary",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "dashboard_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          summary: await getAdminProductAnalyticsSummary(app)
        }
      };
    }
  );
}
