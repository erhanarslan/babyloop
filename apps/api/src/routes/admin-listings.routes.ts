import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminListingActionBodySchema,
  adminListingParamsSchema,
  adminListingsQuerySchema
} from "../schemas/admin-listings.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  applyAdminListingAction,
  getAdminListingDetail,
  listAdminListings,
  type AdminListingDetail,
  type AdminListingSummary
} from "../services/admin-listings.service.js";

type AdminListingsResponse = ApiResponse<{
  listings: AdminListingSummary[];
}>;

type AdminListingDetailResponse = ApiResponse<{
  listing: AdminListingDetail;
}>;

type AdminListingActionResponse = ApiResponse<{
  listingId: string;
  action: string;
  previousStatus: string;
  nextStatus: string;
  auditEventId: string;
}>;

export function registerAdminListingRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: AdminListingsResponse }>(
    "/admin/listings",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminListingsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send(invalidRequest("Admin listing filters are invalid."));
      }

      return {
        ok: true,
        data: {
          listings: await listAdminListings(app, {
            ...(parsedQuery.data.status ? { status: parsedQuery.data.status } : {}),
            ...(parsedQuery.data.q ? { q: parsedQuery.data.q } : {}),
            ...(parsedQuery.data.categoryId
              ? { categoryId: parsedQuery.data.categoryId }
              : {}),
            ...(parsedQuery.data.sort ? { sort: parsedQuery.data.sort } : {}),
            ...(parsedQuery.data.limit ? { limit: parsedQuery.data.limit } : {})
          })
        }
      };
    }
  );

  app.get<{ Params: unknown; Reply: AdminListingDetailResponse }>(
    "/admin/listings/:listingId",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

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
          listing
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: unknown; Reply: AdminListingActionResponse }>(
    "/admin/listings/:listingId/actions",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

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
          auditEventId: result.auditEventId
        }
      };
    }
  );
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
