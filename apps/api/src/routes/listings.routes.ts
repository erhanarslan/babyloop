import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  createListingBodySchema,
  listingParamsSchema,
  listingsQuerySchema,
  updateListingBodySchema,
  updateListingStatusBodySchema
} from "../schemas/listings.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createListing,
  getListingDetail,
  listActiveListings,
  listListingsForCurrentUser,
  updateListing,
  updateListingStatus
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

type UpdateListingResponse = ApiResponse<{
  listing: ListingSummaryResponse;
}>;

type ListingDetailApiResponse = ApiResponse<{
  listing: ListingDetailResponse;
}>;

type ListingParams = {
  id: string;
};

type ListingsQuery = {
  q?: string;
  search?: string;
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

  app.get<{ Querystring: ListingsQuery; Reply: ListingsResponse }>("/listings", async (request, reply) => {
    const parsedQuery = listingsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Listing query is invalid."
        }
      });
    }

    const searchQuery = parsedQuery.data.q ?? parsedQuery.data.search;
    const listings = await listActiveListings(app, searchQuery);

    return {
      ok: true,
      data: {
        listings
      }
    };
  });

  app.get<{ Reply: ListingsResponse }>("/me/listings", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        listings: await listListingsForCurrentUser(app, currentUser)
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

  app.patch<{ Body: unknown; Params: ListingParams; Reply: UpdateListingResponse }>(
    "/listings/:id",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = listingParamsSchema.safeParse(request.params);
      const parsedBody = updateListingBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidListingRequest("Listing id must be a valid UUID."));
      }

      if (!parsedBody.success) {
        return reply.status(400).send(invalidListingRequest("Listing update body is invalid."));
      }

      const result = await updateListing(app, currentUser, parsedParams.data.id, parsedBody.data);

      if (result.status === "not_found") {
        return reply.status(404).send(listingNotFound());
      }

      if (result.status === "forbidden") {
        return reply.status(403).send(listingForbidden());
      }

      if (result.status === "invalid_category") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_CATEGORY",
            message: "Category does not exist."
          }
        });
      }

      if (result.status !== "updated") {
        return reply.status(500).send({
          ok: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
          }
        });
      }

      return {
        ok: true,
        data: {
          listing: result.listing
        }
      };
    }
  );

  app.patch<{ Body: unknown; Params: ListingParams; Reply: UpdateListingResponse }>(
    "/listings/:id/status",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = listingParamsSchema.safeParse(request.params);
      const parsedBody = updateListingStatusBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidListingRequest("Listing id must be a valid UUID."));
      }

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_LISTING_STATUS",
            message: "Listing status is invalid."
          }
        });
      }

      const result = await updateListingStatus(
        app,
        currentUser,
        parsedParams.data.id,
        parsedBody.data.status
      );

      if (result.status === "not_found") {
        return reply.status(404).send(listingNotFound());
      }

      if (result.status === "forbidden") {
        return reply.status(403).send(listingForbidden());
      }

      if (result.status === "invalid_transition") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: "Listing status transition is invalid."
          }
        });
      }

      if (result.status !== "updated") {
        return reply.status(500).send({
          ok: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
          }
        });
      }

      return {
        ok: true,
        data: {
          listing: result.listing
        }
      };
    }
  );
}

function invalidListingRequest(message: string): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}

function listingNotFound(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Listing was not found."
    }
  };
}

function listingForbidden(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "You do not have access to this listing."
    }
  };
}
