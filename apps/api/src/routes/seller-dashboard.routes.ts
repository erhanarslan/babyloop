import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  getSellerDashboardSummary,
  type SellerDashboardSummaryResponse
} from "../services/seller-dashboard.service.js";

type SellerDashboardResponse = ApiResponse<{
  summary: SellerDashboardSummaryResponse;
}>;

export function registerSellerDashboardRoutes(app: FastifyInstance): void {
  app.get<{ Reply: SellerDashboardResponse | ApiFailure }>("/seller/dashboard", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        summary: await getSellerDashboardSummary(app, currentUser.profile.id)
      }
    };
  });
}
