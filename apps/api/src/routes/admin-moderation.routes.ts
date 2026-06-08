import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminModerationActionBodySchema,
  adminModerationCaseParamsSchema,
  adminModerationCasesQuerySchema,
  adminModerationStatusBodySchema
} from "../schemas/admin-moderation.schemas.js";
import { requireAdminUser } from "../services/admin-context.service.js";
import {
  createAdminModerationAction,
  getAdminModerationCaseDetail,
  listAdminModerationCases,
  updateAdminModerationCaseStatus
} from "../services/admin-moderation.service.js";

export function registerAdminModerationRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown }>(
    "/admin/moderation/cases",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminModerationCasesQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation case filters are invalid."));
      }

            const filters = {
        ...(parsedQuery.data.status !== undefined
            ? { status: parsedQuery.data.status }
            : {}),
        ...(parsedQuery.data.targetType !== undefined
            ? { targetType: parsedQuery.data.targetType }
            : {}),
        ...(parsedQuery.data.limit !== undefined
            ? { limit: parsedQuery.data.limit }
            : {})
        };

        return {
        ok: true,
        data: {
            cases: await listAdminModerationCases(app, filters)
        }
        };
    }
  );

  app.get<{ Params: { caseId: string } }>(
    "/admin/moderation/cases/:caseId",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedParams = adminModerationCaseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation case id must be a valid UUID."));
      }

      const result = await getAdminModerationCaseDetail(app, parsedParams.data.caseId);

      if (result.status === "not_found") {
        return reply.status(404).send(notFound("Moderation case was not found."));
      }

      return {
        ok: true,
        data: {
          case: result.case,
          actions: result.actions
        }
      };
    }
  );

  app.patch<{ Body: unknown; Params: { caseId: string } }>(
    "/admin/moderation/cases/:caseId/status",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedParams = adminModerationCaseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation case id must be a valid UUID."));
      }

      const parsedBody = adminModerationStatusBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation status body is invalid."));
      }

      const result = await updateAdminModerationCaseStatus(app, {
        actorProfileId: admin.profile.id,
        caseId: parsedParams.data.caseId,
        status: parsedBody.data.status,
        ...(parsedBody.data.note !== undefined ? { note: parsedBody.data.note } : {})
        });

      if (result.status === "not_found") {
        return reply.status(404).send(notFound("Moderation case was not found."));
      }

      return {
        ok: true,
        data: {
          caseId: result.caseId
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: { caseId: string } }>(
    "/admin/moderation/cases/:caseId/actions",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedParams = adminModerationCaseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation case id must be a valid UUID."));
      }

      const parsedBody = adminModerationActionBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation action body is invalid."));
      }

        const result = await createAdminModerationAction(app, {
        actionType: parsedBody.data.actionType,
        actorProfileId: admin.profile.id,
        caseId: parsedParams.data.caseId,
        ...(parsedBody.data.note !== undefined ? { note: parsedBody.data.note } : {})
        });

      if (result.status === "not_found") {
        return reply.status(404).send(notFound("Moderation case was not found."));
      }

      return reply.status(201).send({
        ok: true,
        data: {
          action: result.action
        }
      });
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