import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { createListingBodySchema, listingParamsSchema } from "../schemas/listings.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createListing,
  getListingDetail,
  listActiveListings
} from "../services/listings.service.js";
import type {
  ListingDetailResponse,
  ListingSummaryResponse
} from "../services/listing-response.mapper.js";

type ListingsResponse = ApiResponse<{
  listings: ListingSummaryResponse[];
}>;

type CreateListingResponse = ApiResponse<{
  listing: ListingSummaryResponse;
}>;

type ListingDetailApiResponse = ApiResponse<{
  listing: ListingDetailResponse;
}>;

type ListingParams = {
  id: string;
};

export function registerListingRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: CreateListingResponse }>("/listings", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedBody = createListingBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Listing request body is invalid."
        }
      });
    }

    const result = await createListing(app, currentUser, parsedBody.data);

    if (result.status === "invalid_category") {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_CATEGORY",
          message: "Category does not exist."
        }
      });
    }

    return reply.status(201).send({
      ok: true,
      data: {
        listing: result.listing
      }
    });
  });

  app.get<{ Reply: ListingsResponse }>("/listings", async () => {
    const listings = await listActiveListings(app);

    return {
      ok: true,
      data: {
        listings
      }
    };
  });

  app.get<{ Params: ListingParams; Reply: ListingDetailApiResponse }>(
    "/listings/:id",
    async (request, reply) => {
      const parsedParams = listingParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Listing id must be a valid UUID."
          }
        });
      }

      const listing = await getListingDetail(app, parsedParams.data.id);

      if (!listing) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Listing was not found."
          }
        });
      }

      return {
        ok: true,
        data: {
          listing
        }
      };
    }
  );
}
