import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminModerationActionBodySchema,
  adminModerationCaseParamsSchema,
  adminModerationCasesQuerySchema,
  adminModerationEnforcementBodySchema,
  adminSensitiveAccessBodySchema,
  adminModerationStatusBodySchema
} from "../schemas/admin-moderation.schemas.js";
import { adminForbidden, hasSensitiveDataAccess, requireAdminUser } from "../services/admin-context.service.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  collectRequestedFieldsForAudit,
  recordSensitiveAccessDenied
} from "../services/admin-sensitive-access-audit.service.js";
import {
  applyAdminModerationEnforcement,
  createAdminModerationAction,
  getAdminModerationSensitiveAccessCaseContext,
  getAdminModerationCaseDetail,
  listAdminModerationCases,
  requestAdminModerationSensitiveAccess,
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
        ...(parsedQuery.data.q !== undefined ? { q: parsedQuery.data.q } : {}),
        ...(parsedQuery.data.sort !== undefined
          ? { sort: parsedQuery.data.sort }
          : {}),
        ...(parsedQuery.data.limit !== undefined
          ? { limit: parsedQuery.data.limit }
          : {})
      };

      const result = await listAdminModerationCases(app, filters);

      return {
        ok: true,
        data: {
          cases: result.cases,
          summary: result.summary
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
          actions: result.actions,
          timeline: result.timeline
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
    "/admin/moderation/cases/:caseId/sensitive-access",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = adminModerationCaseParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation case id must be a valid UUID."));
      }

      const caseContext = await getAdminModerationSensitiveAccessCaseContext(
        app,
        parsedParams.data.caseId
      );

      if (!hasSensitiveDataAccess(currentUser)) {
        if (caseContext) {
          await recordSensitiveAccessDenied(app, {
            actorProfileId: currentUser.profile.id,
            context: caseContext,
            requestedFields: collectRequestedFieldsForAudit(request.body),
            deniedFields: collectRequestedFieldsForAudit(request.body),
            denialReason: "sensitive_access_forbidden"
          });
        }

        return reply.status(403).send(adminForbidden());
      }

      const parsedBody = adminSensitiveAccessBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        if (caseContext) {
          await recordSensitiveAccessDenied(app, {
            actorProfileId: currentUser.profile.id,
            context: caseContext,
            requestedFields: collectRequestedFieldsForAudit(request.body),
            deniedFields: collectRequestedFieldsForAudit(request.body),
            denialReason: "invalid_request_body"
          });
        }

        return reply
          .status(400)
          .send(invalidRequest("Sensitive access request body is invalid."));
      }

      if (!caseContext) {
        await recordSensitiveAccessDenied(app, {
          actorProfileId: currentUser.profile.id,
          context: {
            caseId: parsedParams.data.caseId
          },
          requestedFields: parsedBody.data.fields,
          deniedFields: parsedBody.data.fields,
          denialReason: "moderation_case_not_found"
        });

        return reply.status(404).send(notFound("Moderation case was not found."));
      }

      const result = await requestAdminModerationSensitiveAccess(app, {
        actorProfileId: currentUser.profile.id,
        caseId: parsedParams.data.caseId,
        fields: parsedBody.data.fields,
        reason: parsedBody.data.reason
      });

      if (result.status === "not_found") {
        return reply.status(404).send(notFound("Moderation case was not found."));
      }

      return {
        ok: true,
        data: {
          caseId: result.caseId,
          grantedFields: result.grantedFields,
          sensitive: result.sensitive,
          auditEventId: result.auditEventId
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: { caseId: string } }>(
    "/admin/moderation/cases/:caseId/enforcement",
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

      const parsedBody = adminModerationEnforcementBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send(invalidRequest("Moderation enforcement body is invalid."));
      }

      const result = await applyAdminModerationEnforcement(app, {
        actorProfileId: admin.profile.id,
        caseId: parsedParams.data.caseId,
        action: parsedBody.data.action,
        reason: parsedBody.data.reason
      });

      if (result.status === "not_found") {
        return reply.status(404).send(notFound("Moderation case was not found."));
      }

      if (result.status === "target_not_found") {
        return reply.status(404).send(notFound("Moderation target was not found."));
      }

      if (result.status === "incompatible_action") {
        return reply
          .status(400)
          .send(invalidRequest("Enforcement action is not compatible with this case."));
      }

      if (result.status !== "applied") {
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
          caseId: result.caseId,
          action: result.action,
          targetType: result.targetType,
          targetId: result.targetId,
          resultingStatus: result.resultingStatus,
          moderationActionId: result.moderationActionId,
          auditEventId: result.auditEventId
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
