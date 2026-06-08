import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  createListingBodySchema,
  listingImageParamsSchema,
  listingParamsSchema,
  listingsQuerySchema,
  reorderListingImagesBodySchema,
  updateListingBodySchema,
  updateListingStatusBodySchema
} from "../schemas/listings.schemas.js";
import {
  MAX_LISTING_IMAGE_BYTES,
  validateListingImage
} from "../services/image-safety.service.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  addListingImage,
  createListing,
  deleteListingImage,
  getListingDetail,
  listActiveListings,
  listListingsForCurrentUser,
  reorderListingImages,
  updateListing,
  updateListingStatus
} from "../services/listings.service.js";
import type {
  ListingDetailResponse,
  ListingImageResponse,
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

type ListingImageApiResponse = ApiResponse<{
  image: ListingImageResponse;
}>;

type ListingImagesApiResponse = ApiResponse<{
  images: ListingImageResponse[];
}>;

type DeleteListingImageResponse = ApiResponse<{
  deleted: true;
}>;

type ListingParams = {
  id: string;
};

type ListingImageParams = ListingParams & {
  imageId: string;
};

type ListingsQuery = {
  q?: string;
  search?: string;
};

type ListingRouteOptions = {
  uploadRoot: string;
};

export function registerListingRoutes(app: FastifyInstance, options: ListingRouteOptions): void {
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

  app.post<{ Params: ListingParams; Reply: ListingImageApiResponse }>(
    "/listings/:id/images",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = listingParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidListingRequest("Listing id must be a valid UUID."));
      }

      let multipartFile: Awaited<ReturnType<typeof request.file>> | undefined;

      try {
        multipartFile = await request.file({
          limits: {
            fileSize: MAX_LISTING_IMAGE_BYTES
          }
        });
      } catch {
        return reply.status(413).send({
          ok: false,
          error: {
            code: "IMAGE_TOO_LARGE",
            message: "Image is too large."
          }
        });
      }

      if (!multipartFile || multipartFile.fieldname !== "image") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Image file is required."
          }
        });
      }

      let buffer: Buffer;

      try {
        buffer = await multipartFile.toBuffer();
      } catch {
        return reply.status(413).send({
          ok: false,
          error: {
            code: "IMAGE_TOO_LARGE",
            message: "Image is too large."
          }
        });
      }

      const imageSafety = validateListingImage({
        buffer,
        filename: multipartFile.filename,
        mimetype: multipartFile.mimetype
      });

      if (!imageSafety.ok) {
        return reply.status(imageSafety.code === "IMAGE_TOO_LARGE" ? 413 : 400).send({
          ok: false,
          error: {
            code: imageSafety.code,
            message: imageSafety.message
          }
        });
      }

      const result = await addListingImage(app, currentUser, {
        image: imageSafety.image,
        listingId: parsedParams.data.id,
        uploadRoot: options.uploadRoot
      });

      if (result.status === "not_found") {
        return reply.status(404).send(listingNotFound());
      }

      if (result.status === "forbidden") {
        return reply.status(403).send(listingForbidden());
      }

      if (result.status === "too_many_images") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "TOO_MANY_IMAGES",
            message: "Listing already has the maximum number of images."
          }
        });
      }

      if (result.status !== "created") {
        return reply.status(500).send({
          ok: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Image storage failed."
          }
        });
      }

      return reply.status(201).send({
        ok: true,
        data: {
          image: result.image
        }
      });
    }
  );

  app.delete<{ Params: ListingImageParams; Reply: DeleteListingImageResponse }>(
    "/listings/:id/images/:imageId",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = listingImageParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidListingRequest("Listing image id must be a valid UUID."));
      }

      const result = await deleteListingImage(app, currentUser, {
        imageId: parsedParams.data.imageId,
        listingId: parsedParams.data.id,
        uploadRoot: options.uploadRoot
      });

      if (result.status === "not_found") {
        return reply.status(404).send(listingNotFound());
      }

      if (result.status === "forbidden") {
        return reply.status(403).send(listingForbidden());
      }

      return {
        ok: true,
        data: {
          deleted: true
        }
      };
    }
  );

  app.patch<{ Body: unknown; Params: ListingParams; Reply: ListingImagesApiResponse }>(
    "/listings/:id/images/reorder",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = listingParamsSchema.safeParse(request.params);
      const parsedBody = reorderListingImagesBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidListingRequest("Listing id must be a valid UUID."));
      }

      if (!parsedBody.success) {
        return reply.status(400).send(invalidListingRequest("Image reorder body is invalid."));
      }

      const result = await reorderListingImages(
        app,
        currentUser,
        parsedParams.data.id,
        parsedBody.data.imageIds
      );

      if (result.status === "not_found") {
        return reply.status(404).send(listingNotFound());
      }

      if (result.status === "forbidden") {
        return reply.status(403).send(listingForbidden());
      }

      if (result.status === "invalid_request") {
        return reply.status(400).send(invalidListingRequest("Image ids must match listing images."));
      }

      if (result.status === "updated") {
        return {
          ok: true,
          data: {
            images: result.images
          }
        };
      }

      return reply.status(500).send({
        ok: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error"
        }
      });
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
