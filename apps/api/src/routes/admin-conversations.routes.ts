import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  adminConversationParamsSchema,
  adminConversationsQuerySchema
} from "../schemas/admin-conversations.schemas.js";
import {
  getAdminConversationDetail,
  listAdminConversations,
  type AdminConversationDetail,
  type AdminConversationSummary
} from "../services/admin-conversations.service.js";
import { requireAdminUser } from "../services/admin-context.service.js";

type AdminConversationsResponse = ApiResponse<{
  conversations: AdminConversationSummary[];
}>;

type AdminConversationDetailResponse = ApiResponse<{
  conversation: AdminConversationDetail;
}>;

export function registerAdminConversationRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: unknown; Reply: AdminConversationsResponse }>(
    "/admin/conversations",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedQuery = adminConversationsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send(invalidRequest("Admin conversation filters are invalid."));
      }

      return {
        ok: true,
        data: {
          conversations: await listAdminConversations(app, parsedQuery.data)
        }
      };
    }
  );

  app.get<{ Params: unknown; Reply: AdminConversationDetailResponse }>(
    "/admin/conversations/:conversationId",
    async (request, reply) => {
      const admin = await requireAdminUser(app, request, reply);

      if (!admin) {
        return reply;
      }

      const parsedParams = adminConversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidRequest("Conversation id must be a valid UUID."));
      }

      const conversation = await getAdminConversationDetail(app, parsedParams.data.conversationId);

      if (!conversation) {
        return reply.status(404).send(notFound("Conversation was not found."));
      }

      return {
        ok: true,
        data: {
          conversation
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
