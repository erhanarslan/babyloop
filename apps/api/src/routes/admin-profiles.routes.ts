import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminProfileEnforcementBodySchema,
  adminProfileParamsSchema,
  adminProfilesQuerySchema
} from "../schemas/admin-profiles.schemas.js";
import { requireBackofficePermission } from "../services/admin-context.service.js";
import {
  applyAdminProfileEnforcement,
  getAdminProfileDetail,
  listAdminProfiles,
  type AdminProfileDetail,
  type AdminProfileEnforcementApplied,
  type AdminProfileSummary
} from "../services/admin-profiles.service.js";

type AdminProfilesResponse = ApiResponse<{
  profiles: Array<AdminProfileSummary | ViewerProfile>;
}>;

type AdminProfileDetailResponse = ApiResponse<{
  profile: AdminProfileDetail | ViewerProfile;
}>;

type ViewerProfile = Pick<
  AdminProfileSummary,
  "profileId" | "displayName" | "locationCity" | "createdAt" | "listingCount"
>;

type AdminProfileEnforcementResponse = ApiResponse<{
  profile: AdminProfileDetail;
  enforcement: AdminProfileEnforcementApplied;
}>;

export function registerAdminProfileRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: AdminProfilesResponse }>(
    "/admin/profiles",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "profile_view");

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

      const profiles = await listAdminProfiles(app, parsedQuery.data);

      return {
        ok: true,
        data: {
          profiles: admin.role === "backoffice_viewer"
            ? profiles.map(projectProfileForViewer)
            : profiles
        }
      };
    }
  );

  app.get<{ Params: unknown; Reply: AdminProfileDetailResponse }>(
    "/admin/profiles/:profileId",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "profile_view");

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
          profile: admin.role === "backoffice_viewer" ? projectProfileForViewer(profile) : profile
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: unknown; Reply: AdminProfileEnforcementResponse }>(
    "/admin/profiles/:profileId/enforcement",
    async (request, reply) => {
      const admin = await requireBackofficePermission(app, request, reply, "profile_enforce");

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

      const parsedBody = adminProfileEnforcementBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Profile enforcement action and reason are required."
          }
        });
      }

      const result = await applyAdminProfileEnforcement(app, {
        actorProfileId: admin.profile.id,
        profileId: parsedParams.data.profileId,
        action: parsedBody.data.action,
        reason: parsedBody.data.reason
      });

      if (result.status === "not_found") {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Profile was not found."
          }
        });
      }

      if (result.status === "invalid_transition") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_TRANSITION",
            message: "Profile is already in the requested safety state."
          }
        });
      }

      if (result.status === "incompatible_action") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_ACTION",
            message: "Profile enforcement action is not compatible with profile targets."
          }
        });
      }

      return {
        ok: true,
        data: {
          profile: (result as { profile: any; enforcement: any }).profile,
          enforcement: (result as { profile: any; enforcement: any }).enforcement
        }
      };
    }
  );
}

function projectProfileForViewer(profile: AdminProfileSummary): ViewerProfile {
  return {
    profileId: profile.profileId,
    displayName: profile.displayName,
    locationCity: profile.locationCity,
    createdAt: profile.createdAt,
    listingCount: profile.listingCount,
  };
}
