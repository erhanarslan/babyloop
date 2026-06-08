import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  listingReportParamsSchema,
  messageReportParamsSchema,
  profileParamsSchema,
  reportBodySchema
} from "../schemas/safety.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  blockProfile,
  createSafetyReport,
  listBlockedProfiles,
  unblockProfile,
  type BlockedProfileResponse,
  type ReportResponse,
  type SafetyTargetType
} from "../services/safety.service.js";

type ReportApiResponse = ApiResponse<{
  report: ReportResponse;
}>;

type BlockApiResponse = ApiResponse<{
  blockedProfile: BlockedProfileResponse;
  created: boolean;
}>;

type UnblockApiResponse = ApiResponse<{
  removed: boolean;
}>;

type BlockedProfilesResponse = ApiResponse<{
  blockedProfiles: BlockedProfileResponse[];
}>;

export function registerSafetyRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Params: { listingId: string }; Reply: ReportApiResponse }>(
    "/reports/listings/:listingId",
    async (request, reply) => {
      const parsedParams = listingReportParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidRequest("Listing id must be a valid UUID."));
      }

      return handleReport(
        app,
        request,
        reply,
        "listing",
        parsedParams.data.listingId
      );
    }
  );

  app.post<{ Body: unknown; Params: { profileId: string }; Reply: ReportApiResponse }>(
    "/reports/profiles/:profileId",
    async (request, reply) => {
      const parsedParams = profileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidRequest("Profile id must be a valid UUID."));
      }

      return handleReport(
        app,
        request,
        reply,
        "profile",
        parsedParams.data.profileId
      );
    }
  );

  app.post<{ Body: unknown; Params: { messageId: string }; Reply: ReportApiResponse }>(
    "/reports/messages/:messageId",
    async (request, reply) => {
      const parsedParams = messageReportParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidRequest("Message id must be a valid UUID."));
      }

      return handleReport(
        app,
        request,
        reply,
        "message",
        parsedParams.data.messageId
      );
    }
  );

  app.post<{ Params: { profileId: string }; Reply: BlockApiResponse }>(
    "/profiles/:profileId/block",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = profileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidRequest("Profile id must be a valid UUID."));
      }

      const result = await blockProfile(
        app,
        currentUser.profile.id,
        parsedParams.data.profileId
      );

      if (result.status !== "blocked") {
        return reply
          .status(result.status === "not_found" ? 404 : 400)
          .send(safetyError(result.status));
      }

      return reply.status(result.created ? 201 : 200).send({
        ok: true,
        data: {
          blockedProfile: result.profile,
          created: result.created
        }
      });
    }
  );

  app.delete<{ Params: { profileId: string }; Reply: UnblockApiResponse }>(
    "/profiles/:profileId/block",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = profileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidRequest("Profile id must be a valid UUID."));
      }

      const result = await unblockProfile(
        app,
        currentUser.profile.id,
        parsedParams.data.profileId
      );

      if (result.status !== "unblocked") {
        return reply
          .status(result.status === "not_found" ? 404 : 400)
          .send(safetyError(result.status));
      }

      return {
        ok: true,
        data: {
          removed: result.removed
        }
      };
    }
  );

  app.get<{ Reply: BlockedProfilesResponse }>(
    "/profiles/blocked",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return {
        ok: true,
        data: {
          blockedProfiles: await listBlockedProfiles(app, currentUser.profile.id)
        }
      };
    }
  );
}

async function handleReport(
  app: FastifyInstance,
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply,
  targetType: SafetyTargetType,
  targetId: string
) {
  const currentUser = await requireCurrentUser(app, request, reply);

  if (!currentUser) {
    return reply;
  }

  const parsedBody = reportBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return reply.status(400).send(invalidRequest("Report request body is invalid."));
  }

  const result = await createSafetyReport(
    app,
    currentUser.profile.id,
    targetType,
    targetId,
    parsedBody.data
  );

  if (result.status !== "reported") {
    return reply
      .status(result.status === "not_found" ? 404 : result.status === "forbidden" ? 403 : 400)
      .send(safetyError(result.status));
  }

  return reply.status(result.report.created ? 201 : 200).send({
    ok: true,
    data: {
      report: result.report
    }
  });
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

function safetyError(status: "not_found" | "forbidden" | "cannot_report_self" | "cannot_block_self"): ApiResponse<never> {
  if (status === "not_found") {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Safety target was not found."
      }
    };
  }

  if (status === "cannot_report_self") {
    return {
      ok: false,
      error: {
        code: "CANNOT_REPORT_SELF",
        message: "You cannot report yourself."
      }
    };
  }

  if (status === "cannot_block_self") {
    return {
      ok: false,
      error: {
        code: "CANNOT_BLOCK_SELF",
        message: "You cannot block yourself."
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "You cannot report this target."
    }
  };
}
