import type { ApiResponse } from "@babyloop/shared";
import { productCategories } from "@babyloop/database/schema";
import { asc } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  ListingDraftSuggestionImageInput,
  ListingDraftSuggestionOutput,
  ListingDraftSuggestionProvider
} from "@babyloop/ai-core";
import { aiListingDraftFieldsSchema } from "../schemas/ai-listing-draft-suggestions.schemas.js";
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
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  validateListingImage
} from "../services/image-safety.service.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  addListingImage,
  createListing,
  deleteListingImage,
  getListingDetail,
  listActiveListingsPage,
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
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasNextPage: boolean;
  };
}>;

type MyListingsResponse = ApiResponse<{
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

type AiListingDraftSuggestionResponse = ApiResponse<{
  suggestion: ListingDraftSuggestionOutput;
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

type ListingsQuery = Record<string, unknown>;

type ListingRouteOptions = {
  listingDraftSuggestionProvider?: ListingDraftSuggestionProvider | null;
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

    if (result.status === "profile_not_allowed") {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "PROFILE_NOT_ALLOWED_TO_CREATE_LISTING",
          message: "This profile cannot create listings right now."
        }
      });
    }

    if (result.status === "image_urls_not_allowed") {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "LISTING_IMAGE_UPLOAD_REQUIRED",
          message: "Listing images must be uploaded through the image upload endpoint."
        }
      });
    }

    if (result.status !== "created") {
      return reply.status(500).send({
        ok: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error"
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

    const result = await listActiveListingsPage(app, parsedQuery.data);

    return {
      ok: true,
      data: result
    };
  });

  app.post<{ Reply: AiListingDraftSuggestionResponse }>(
    "/listings/ai-draft-suggestions",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const provider = options.listingDraftSuggestionProvider ?? null;

      if (!provider) {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "AI_LISTING_DRAFT_UNAVAILABLE",
            message: "AI önerisi şu an yapılandırılmadı."
          }
        });
      }

      const collected = await collectListingDraftMultipart(request);

      if (collected.status === "too_large") {
        return reply.status(413).send({
          ok: false,
          error: {
            code: "IMAGE_TOO_LARGE",
            message: "Görsel çok büyük."
          }
        });
      }

      if (collected.status === "invalid_image") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: collected.code,
            message: collected.code === "IMAGE_TOO_LARGE" ? "Görsel çok büyük." : "Görsel dosyası desteklenmiyor."
          }
        });
      }

      if (collected.status === "too_many_images") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "TOO_MANY_IMAGES",
            message: "En fazla 5 görsel incelenebilir."
          }
        });
      }

      const parsedFields = aiListingDraftFieldsSchema.safeParse(collected.fields);

      if (!parsedFields.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "AI önerisi isteği geçersiz."
          }
        });
      }

      if (collected.images.length === 0 && !hasDraftTextFields(parsedFields.data)) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "AI önerisi için önce bir bilgi veya görsel ekle."
          }
        });
      }

      const categoryCandidates = await app.db
        .select({
          id: productCategories.id,
          name: productCategories.name,
          slug: productCategories.slug
        })
        .from(productCategories)
        .orderBy(asc(productCategories.name));
      const selectedCategory = parsedFields.data.categoryId
        ? categoryCandidates.find((category) => category.id === parsedFields.data.categoryId)
        : undefined;

      try {
        const suggestion = await provider.suggestListingDraft({
          ...buildListingDraftSuggestionInputFields(parsedFields.data),
          ...(selectedCategory ? { categoryName: selectedCategory.name } : {}),
          images: collected.images,
          categoryCandidates
        });

        return {
          ok: true,
          data: {
            suggestion: sanitizeListingDraftSuggestion(suggestion, categoryCandidates)
          }
        };
      } catch {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "AI_LISTING_DRAFT_UNAVAILABLE",
            message: "AI önerisi şu an kullanılamıyor. Bilgileri manuel girebilirsin."
          }
        });
      }
    }
  );

  app.get<{ Reply: MyListingsResponse }>("/me/listings", async (request, reply) => {
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

      if (result.status === "image_urls_not_allowed") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "LISTING_IMAGE_UPDATE_UPLOAD_REQUIRED",
            message: "Listing images must be uploaded, deleted, or reordered through the dedicated image endpoints."
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
        originalFilename: multipartFile.filename,
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

      if (result.status === "authenticity_rejected") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "IMAGE_AUTHENTICITY_REJECTED",
            message: result.reason
          }
        });
      }

      if (result.status === "authenticity_unavailable") {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "IMAGE_AUTHENTICITY_UNAVAILABLE",
            message: result.reason
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

type ListingDraftMultipartResult =
  | {
      status: "ok";
      fields: Record<string, string>;
      images: ListingDraftSuggestionImageInput[];
    }
  | { status: "too_large" }
  | { status: "too_many_images" }
  | { status: "invalid_image"; code: "INVALID_IMAGE" | "IMAGE_TOO_LARGE"; message: string };

async function collectListingDraftMultipart(
  request: FastifyRequest
): Promise<ListingDraftMultipartResult> {
  const fields: Record<string, string> = {};
  const images: ListingDraftSuggestionImageInput[] = [];

  try {
    for await (const part of request.parts({
      limits: {
        fileSize: MAX_LISTING_IMAGE_BYTES,
        files: MAX_LISTING_IMAGES
      }
    })) {
      if (part.type === "file") {
        if (part.fieldname !== "images" && part.fieldname !== "image") {
          continue;
        }

        if (images.length >= MAX_LISTING_IMAGES) {
          return { status: "too_many_images" };
        }

        let buffer: Buffer;

        try {
          buffer = await part.toBuffer();
        } catch {
          return { status: "too_large" };
        }

        const imageSafety = validateListingImage({
          buffer,
          filename: part.filename,
          mimetype: part.mimetype
        });

        if (!imageSafety.ok) {
          return {
            status: "invalid_image",
            code: imageSafety.code,
            message: imageSafety.message
          };
        }

        const id = `image-${images.length + 1}`;
        images.push({
          id,
          ...(part.filename ? { filename: part.filename } : {}),
          contentType: imageSafety.image.contentType,
          dataUrl: `data:${imageSafety.image.contentType};base64,${imageSafety.image.buffer.toString("base64")}`
        });
        continue;
      }

      if (typeof part.value === "string") {
        fields[part.fieldname] = part.value;
      }
    }
  } catch {
    return { status: "too_large" };
  }

  return {
    status: "ok",
    fields,
    images
  };
}

function hasDraftTextFields(fields: Partial<Record<"categoryId" | "listingType" | "title" | "description" | "condition" | "priceAmount" | "city", string | undefined>>): boolean {
  return Boolean(
    fields.categoryId ||
      fields.listingType ||
      fields.title ||
      fields.description ||
      fields.condition ||
      fields.priceAmount ||
      fields.city
  );
}

function buildListingDraftSuggestionInputFields(fields: {
  categoryId?: string | undefined;
  listingType?: "sale" | "swap" | "donation" | undefined;
  title?: string | undefined;
  description?: string | undefined;
  condition?: "new" | "like_new" | "good" | "fair" | "needs_repair" | undefined;
  priceAmount?: string | undefined;
  currency: "TRY";
  city?: string | undefined;
  locale: "tr";
}) {
  return {
    locale: fields.locale,
    currency: fields.currency,
    ...(fields.categoryId ? { categoryId: fields.categoryId } : {}),
    ...(fields.listingType ? { listingType: fields.listingType } : {}),
    ...(fields.title ? { title: fields.title } : {}),
    ...(fields.description ? { description: fields.description } : {}),
    ...(fields.condition ? { condition: fields.condition } : {}),
    ...(fields.priceAmount ? { priceAmount: fields.priceAmount } : {}),
    ...(fields.city ? { city: fields.city } : {})
  };
}

function sanitizeListingDraftSuggestion(
  suggestion: ListingDraftSuggestionOutput,
  categoryCandidates: Array<{ id: string; name: string; slug: string }>
): ListingDraftSuggestionOutput {
  const categoryId = suggestion.categoryId && categoryCandidates.some((category) => category.id === suggestion.categoryId)
    ? suggestion.categoryId
    : undefined;

  return {
    ...(suggestion.title ? { title: suggestion.title.slice(0, 160) } : {}),
    ...(suggestion.description ? { description: suggestion.description.slice(0, 2000) } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(suggestion.condition ? { condition: suggestion.condition } : {}),
    ...(suggestion.priceSuggestion ? { priceSuggestion: suggestion.priceSuggestion } : {}),
    imageFeedback: suggestion.imageFeedback.slice(0, MAX_LISTING_IMAGES).map((item) => ({
      imageIdOrUrl: item.imageIdOrUrl,
      status: item.status,
      message: item.message.slice(0, 240)
    })),
    missingDetails: suggestion.missingDetails.slice(0, 8).map((item) => item.slice(0, 120)),
    warnings: suggestion.warnings.slice(0, 8).map((item) => item.slice(0, 180)),
    confidence: suggestion.confidence,
    providerName: suggestion.providerName,
    promptVersion: suggestion.promptVersion,
    ...(suggestion.modelName ? { modelName: suggestion.modelName } : {})
  };
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
