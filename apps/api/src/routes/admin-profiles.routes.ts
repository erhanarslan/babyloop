import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { adminProfilesQuerySchema } from "../schemas/admin-profiles.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  listAdminProfiles,
  type AdminProfileSummary
} from "../services/admin-profiles.service.js";

type AdminProfilesResponse = ApiResponse<{
  profiles: AdminProfileSummary[];
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
}
