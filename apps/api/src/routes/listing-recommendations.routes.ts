import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  listingRecommendationsParamsSchema,
  listingRecommendationsQuerySchema
} from "../schemas/listing-recommendations.schemas.js";
import { listListingRecommendations } from "../services/listing-recommendations.service.js";
import type { ListingSummaryResponse } from "../services/listing-response.mapper.js";

type ListingRecommendationsResponse = ApiResponse<{
  recommendations: ListingSummaryResponse[];
}>;

export function registerListingRecommendationRoutes(app: FastifyInstance): void {
  app.get<{
    Params: unknown;
    Querystring: unknown;
    Reply: ListingRecommendationsResponse | ApiFailure;
  }>("/listings/:listingId/recommendations", async (request, reply) => {
    const parsedParams = listingRecommendationsParamsSchema.safeParse(request.params);
    const parsedQuery = listingRecommendationsQuerySchema.safeParse(request.query);

    if (!parsedParams.success || !parsedQuery.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Listing recommendation request is invalid."
        }
      });
    }

    const result = await listListingRecommendations(
      app,
      parsedParams.data.listingId,
      parsedQuery.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "LISTING_NOT_FOUND",
          message: "Listing was not found."
        }
      });
    }

    return {
      ok: true,
      data: {
        recommendations: result.recommendations
      }
    };
  });
}
