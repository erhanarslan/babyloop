import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { adminAuditEventsQuerySchema } from "../schemas/admin-audit.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  listAdminAuditEvents,
  type AdminAuditEventSummary
} from "../services/admin-audit.service.js";

type AdminAuditEventsResponse = ApiResponse<{
  events: AdminAuditEventSummary[];
}>;

export function registerAdminAuditRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: AdminAuditEventsResponse }>(
    "/admin/audit/events",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminAuditEventsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Audit event filters are invalid."
          }
        });
      }

      return {
        ok: true,
        data: {
          events: await listAdminAuditEvents(app, parsedQuery.data)
        }
      };
    }
  );
}
