import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyRequest, RouteShorthandOptions } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import {
  analyticsEventBatchSchema,
  type AnalyticsBatchIngestResponse
} from "../schemas/analytics.schemas.js";
import { ingestAnalyticsBatch } from "../services/product-analytics.service.js";

type AnalyticsBatchResponse = ApiResponse<AnalyticsBatchIngestResponse>;

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: AnalyticsBatchResponse | ApiFailure }>(
    "/analytics/events/batch",
    analyticsRateLimitOptions(),
    async (request, reply) => {
      const parsedBody = analyticsEventBatchSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_ANALYTICS_EVENTS",
            message: "Analytics event batch is invalid."
          }
        });
      }

      const currentUser = await getOptionalCurrentUser(app, request);
      const result = await ingestAnalyticsBatch(app, {
        currentUser,
        events: parsedBody.data.events
      });

      return {
        ok: true,
        data: result
      };
    }
  );
}

async function getOptionalCurrentUser(
  app: FastifyInstance,
  request: FastifyRequest
): Promise<CurrentUser | null> {
  if (typeof app.authenticate !== "function") {
    return null;
  }

  try {
    return await app.authenticate(request);
  } catch {
    return null;
  }
}

function analyticsRateLimitOptions(): RouteShorthandOptions {
  return {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: 60_000
      }
    }
  };
}
