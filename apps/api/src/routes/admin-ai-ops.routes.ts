import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { adminAiOpsRunsQuerySchema } from "../schemas/admin-ai-ops.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import {
  getAdminAiOpsSummary,
  listAdminAiOpsRuns,
  type AdminAiOpsRunSummary,
  type AdminAiOpsSummary
} from "../services/admin-ai-ops.service.js";

type AdminAiOpsSummaryApiResponse = ApiResponse<{
  summary: AdminAiOpsSummary;
}>;

type AdminAiOpsRunsApiResponse = ApiResponse<{
  runs: AdminAiOpsRunSummary[];
}>;

export function registerAdminAiOpsRoutes(app: FastifyInstance): void {
  app.get<{ Reply: AdminAiOpsSummaryApiResponse }>(
    "/admin/ai-ops/summary",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          summary: await getAdminAiOpsSummary(app)
        }
      };
    }
  );

  app.get<{ Querystring: unknown; Reply: AdminAiOpsRunsApiResponse }>(
    "/admin/ai-ops/runs",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "ai_ops_view");

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminAiOpsRunsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "AI ops filters are invalid."
          }
        });
      }

      return {
        ok: true,
        data: {
          runs: await listAdminAiOpsRuns(app, parsedQuery.data)
        }
      };
    }
  );
}
