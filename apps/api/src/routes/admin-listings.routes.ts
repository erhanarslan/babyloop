import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminListingActionBodySchema,
  adminListingImageActionBodySchema,
  adminListingImageParamsSchema,
  adminListingParamsSchema,
  adminListingPublicationSettingsBodySchema,
  adminListingsQuerySchema
} from "../schemas/admin-listings.schemas.js";
import {
  isBackofficeReadOnlyPrincipal,
  requireBackofficePermission
} from "../services/admin-context.service.js";
import {
  applyAdminListingAction,
  applyAdminListingImageAction,
  getAdminListingDetail,
  listAdminListings,
  type AdminListingDetail,
  type AdminListingImageReview,
  type AdminListingSummary
} from "../services/admin-listings.service.js";
import {
  getMarketplacePublicationSettings,
  updateMarketplacePublicationSettings,
  type MarketplacePublicationSettings
} from "../services/listing-publication.service.js";

type AdminListingsResponse = ApiResponse<{
  listings: Array<AdminListingSummary | ViewerListingSummary>;
}>;

type AdminListingDetailResponse = ApiResponse<{
  listing: AdminListingDetail | ViewerListingDetail;
}>;

type ViewerListingImage = Pick<
  AdminListingImageReview,
  "id" | "url" | "sortOrder" | "reviewStatus" | "createdAt"
>;

type ViewerListingSummary = Pick<
  AdminListingSummary,
  | "id"
  | "title"
  | "description"
  | "price"
  | "currency"
  | "status"
  | "publicationState"
  | "publishAfter"
  | "publishedAt"
  | "listingType"
  | "condition"
  | "category"
  | "seller"
  | "imageCount"
  | "createdAt"
  | "updatedAt"
> & {
  primaryImage: ViewerListingImage | null;
};

type ViewerListingDetail = ViewerListingSummary & {
  images: ViewerListingImage[];
};

type AdminListingActionResponse = ApiResponse<{
  listingId: string;
  action: string;
  previousStatus: string;
  nextStatus: string;
  previousPublicationState: string;
  nextPublicationState: string;
  auditEventId: string;
}>;

type AdminListingPublicationSettingsResponse = ApiResponse<{
  settings: MarketplacePublicationSettings;
}>;

type AdminListingImageActionResponse = ApiResponse<{
  image: AdminListingImageReview;
  auditEventId: string;
}>;

export function registerAdminListingRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: AdminListingsResponse }>(
    "/admin/listings",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "listing_view");

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminListingsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send(invalidRequest("Admin listing filters are invalid."));
      }

      const listings = await listAdminListings(app, {
        ...(parsedQuery.data.status ? { status: parsedQuery.data.status } : {}),
        ...(parsedQuery.data.imageReviewStatus
          ? { imageReviewStatus: parsedQuery.data.imageReviewStatus }
          : {}),
        ...(parsedQuery.data.publicationState
          ? { publicationState: parsedQuery.data.publicationState }
          : {}),
        ...(parsedQuery.data.q ? { q: parsedQuery.data.q } : {}),
        ...(parsedQuery.data.categoryId
          ? { categoryId: parsedQuery.data.categoryId }
          : {}),
        ...(parsedQuery.data.sort ? { sort: parsedQuery.data.sort } : {}),
        ...(parsedQuery.data.limit ? { limit: parsedQuery.data.limit } : {})
      });

      return {
        ok: true,
        data: {
          listings: isBackofficeReadOnlyPrincipal(admin)
            ? listings.map(projectListingSummaryForViewer)
            : listings
        }
      };
    }
  );

  app.get<{ Reply: AdminListingPublicationSettingsResponse }>(
    "/admin/listings/publication-settings",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "listing_review");

      if (!admin) {
        return reply;
      }

      return {
        ok: true,
        data: {
          settings: await getMarketplacePublicationSettings(app)
        }
      };
    }
  );

  app.patch<{ Body: unknown; Reply: AdminListingPublicationSettingsResponse }>(
    "/admin/listings/publication-settings",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "listing_review");

      if (!admin) {
        return reply;
      }

      const parsedBody = adminListingPublicationSettingsBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send(invalidRequest("Publication settings body is invalid."));
      }

      return {
        ok: true,
        data: {
          settings: await updateMarketplacePublicationSettings(app, {
            actorProfileId: admin.profile.id,
            adminReviewEnabled: parsedBody.data.adminReviewEnabled,
            autoPublishDelaySeconds: parsedBody.data.autoPublishDelaySeconds
          })
        }
      };
    }
  );

  app.get<{ Params: unknown; Reply: AdminListingDetailResponse }>(
    "/admin/listings/:listingId",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "listing_view");

      if (!admin) {
        return reply;
      }

      const parsedParams = adminListingParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Listing id must be a valid UUID."));
      }

      const listing = await getAdminListingDetail(app, parsedParams.data.listingId);

      if (!listing) {
        return reply.status(404).send(notFound("Listing was not found."));
      }

      return {
        ok: true,
        data: {
          listing: isBackofficeReadOnlyPrincipal(admin)
            ? projectListingDetailForViewer(listing)
            : listing
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: unknown; Reply: AdminListingActionResponse }>(
    "/admin/listings/:listingId/actions",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "listing_review");

      if (!admin) {
        return reply;
      }

      const parsedParams = adminListingParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Listing id must be a valid UUID."));
      }

      const parsedBody = adminListingActionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send(invalidRequest("Admin listing action body is invalid."));
      }

      const result = await applyAdminListingAction(app, {
        actorProfileId: admin.profile.id,
        listingId: parsedParams.data.listingId,
        action: parsedBody.data.action,
        reason: parsedBody.data.reason
      });

      if (result.status === "not_found") {
        return reply.status(404).send(notFound("Listing was not found."));
      }

      if (result.status === "unsupported_action") {
        return reply.status(400).send(invalidRequest("Listing action is invalid."));
      }

      if (result.status === "invalid_transition") {
        return reply
          .status(400)
          .send(invalidRequest("Listing action is not valid for the current status."));
      }

      if (result.status === "approved_image_required") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "LISTING_APPROVED_IMAGE_REQUIRED",
            message: "Listing must have at least one approved image before publication."
          }
        });
      }

      if (result.status === "image_review_pending") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "LISTING_IMAGE_REVIEW_PENDING",
            message: "Every listing image must complete review before publication."
          }
        });
      }

      if (result.status === "invalid_state") {
        return reply
          .status(400)
          .send(invalidRequest("Listing publication action is not valid for the current state."));
      }

      if (result.status !== "applied") {
        return reply.status(400).send(invalidRequest("Listing action is invalid."));
      }

      return {
        ok: true,
        data: {
          listingId: result.listingId,
          action: result.action,
          previousStatus: result.previousStatus,
          nextStatus: result.nextStatus,
          previousPublicationState: result.previousPublicationState,
          nextPublicationState: result.nextPublicationState,
          auditEventId: result.auditEventId
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: unknown; Reply: AdminListingImageActionResponse }>(
    "/admin/listings/:listingId/images/:imageId/actions",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "listing_review");

      if (!admin) {
        return reply;
      }

      const parsedParams = adminListingImageParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Listing and image ids must be valid UUIDs."));
      }

      const parsedBody = adminListingImageActionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send(invalidRequest("Admin listing image action body is invalid."));
      }

      const result = await applyAdminListingImageAction(app, {
        actorProfileId: admin.profile.id,
        action: parsedBody.data.action,
        imageId: parsedParams.data.imageId,
        listingId: parsedParams.data.listingId,
        reason: parsedBody.data.reason
      });

      if (result.status === "not_found" || result.status === "image_not_found") {
        return reply.status(404).send(notFound("Listing image was not found."));
      }

      if (result.status === "unsupported_action") {
        return reply.status(400).send(invalidRequest("Listing image action is invalid."));
      }

      if (result.status === "invalid_transition") {
        return reply
          .status(400)
          .send(invalidRequest("Listing image action is not valid for the current review status."));
      }

      if (result.status !== "applied") {
        return reply.status(400).send(invalidRequest("Listing image action is invalid."));
      }

      return {
        ok: true,
        data: {
          image: result.image,
          auditEventId: result.auditEventId
        }
      };
    }
  );
}

function projectListingImageForViewer(image: AdminListingImageReview): ViewerListingImage {
  return {
    id: image.id,
    url: image.url,
    sortOrder: image.sortOrder,
    reviewStatus: image.reviewStatus,
    createdAt: image.createdAt,
  };
}

function projectListingSummaryForViewer(listing: AdminListingSummary): ViewerListingSummary {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    currency: listing.currency,
    status: listing.status,
    publicationState: listing.publicationState,
    publishAfter: listing.publishAfter,
    publishedAt: listing.publishedAt,
    listingType: listing.listingType,
    condition: listing.condition,
    category: listing.category,
    seller: listing.seller,
    primaryImage: listing.primaryImage
      ? projectListingImageForViewer(listing.primaryImage)
      : null,
    imageCount: listing.imageCount,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

function projectListingDetailForViewer(listing: AdminListingDetail): ViewerListingDetail {
  return {
    ...projectListingSummaryForViewer(listing),
    images: listing.images.map(projectListingImageForViewer),
  };
}

function invalidRequest(message: string): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}

function notFound(message: string): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message
    }
  };
}
