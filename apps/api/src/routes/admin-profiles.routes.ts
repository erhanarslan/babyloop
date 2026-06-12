import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminProfileParamsSchema,
  adminProfilesQuerySchema
} from "../schemas/admin-profiles.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  getAdminProfileDetail,
  listAdminProfiles,
  type AdminProfileDetail,
  type AdminProfileSummary
} from "../services/admin-profiles.service.js";

type AdminProfilesResponse = ApiResponse<{
  profiles: AdminProfileSummary[];
}>;

type AdminProfileDetailResponse = ApiResponse<{
  profile: AdminProfileDetail;
}>;

export function registerAdminProfileRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: AdminProfilesResponse }>(
    "/admin/profiles",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminProfilesQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Admin profile filters are invalid."
          }
        });
      }

      return {
        ok: true,
        data: {
          profiles: await listAdminProfiles(app, parsedQuery.data)
        }
      };
    }
  );

  app.get<{ Params: unknown; Reply: AdminProfileDetailResponse }>(
    "/admin/profiles/:profileId",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedParams = adminProfileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Profile id must be a valid UUID."
          }
        });
      }

      const profile = await getAdminProfileDetail(app, parsedParams.data.profileId);

      if (!profile) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Profile was not found."
          }
        });
      }

      return {
        ok: true,
        data: {
          profile
        }
      };
    }
  );
}
