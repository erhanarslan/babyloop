import { moderateMessageBody, type ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  conversationParamsSchema,
  createConversationBodySchema,
  sendMessageBodySchema
} from "../schemas/messaging.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createOrGetConversation,
  getConversationForProfile,
  listConversationsForProfile,
  listMessagesForConversation,
  sendMessage,
  type ConversationSummaryResponse,
  type MessageResponse
} from "../services/messaging.service.js";
import { publishPersistedMessage } from "../realtime/publisher.js";

type ConversationResponse = ApiResponse<{
  conversation: ConversationSummaryResponse;
}>;

type ConversationsResponse = ApiResponse<{
  conversations: ConversationSummaryResponse[];
}>;

type MessagesResponse = ApiResponse<{
  messages: MessageResponse[];
}>;

type SendMessageResponse = ApiResponse<{
  message: MessageResponse;
}>;

type ConversationParams = {
  id: string;
};

export function registerMessagingRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: ConversationResponse }>(
    "/conversations",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = createConversationBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation request body is invalid."));
      }

      const result = await createOrGetConversation(app, currentUser, parsedBody.data);

      if (result.status === "invalid_listing") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_LISTING",
            message: "Listing does not exist."
          }
        });
      }

      if (result.status === "cannot_message_self") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "CANNOT_MESSAGE_SELF",
            message: "You cannot start a conversation for your own listing."
          }
        });
      }

      if (result.status !== "created" && result.status !== "existing") {
        return reply.status(500).send({
          ok: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
          }
        });
      }

      return reply.status(result.status === "created" ? 201 : 200).send({
        ok: true,
        data: {
          conversation: result.conversation
        }
      });
    }
  );

  app.get<{ Reply: ConversationsResponse }>("/conversations", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        conversations: await listConversationsForProfile(app, currentUser.profile.id)
      }
    };
  });

  app.get<{ Params: ConversationParams; Reply: ConversationResponse }>(
    "/conversations/:id",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      const result = await getConversationForProfile(
        app,
        parsedParams.data.id,
        currentUser.profile.id
      );

      if (result.status !== "ok") {
        return reply.status(result.status === "not_found" ? 404 : 403).send(accessError(result.status));
      }

      return {
        ok: true,
        data: {
          conversation: result.conversation
        }
      };
    }
  );

  app.get<{ Params: ConversationParams; Reply: MessagesResponse }>(
    "/conversations/:id/messages",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      const result = await listMessagesForConversation(app, currentUser, parsedParams.data.id);

      if (result.status !== "ok") {
        return reply.status(result.status === "not_found" ? 404 : 403).send(accessError(result.status));
      }

      return {
        ok: true,
        data: {
          messages: result.messages
        }
      };
    }
  );

  app.post<{ Body: unknown; Params: ConversationParams; Reply: SendMessageResponse }>(
    "/conversations/:id/messages",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedParams = conversationParamsSchema.safeParse(request.params);
      const parsedBody = sendMessageBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send(invalidMessagingRequest("Conversation id must be a valid UUID."));
      }

      if (!parsedBody.success) {
        return reply.status(400).send(invalidMessagingRequest("Message body is invalid."));
      }

      const moderation = moderateMessageBody(parsedBody.data.body);

      if (!moderation.allowed) {
        return reply.status(400).send(messageBlockedResponse());
      }

      const result = await sendMessage(app, currentUser, parsedParams.data.id, parsedBody.data);

      if (result.status !== "sent") {
        return reply.status(result.status === "not_found" ? 404 : 403).send(accessError(result.status));
      }

      await publishPersistedMessage(app, parsedParams.data.id, result.message);

      return reply.status(201).send({
        ok: true,
        data: {
          message: result.message
        }
      });
    }
  );
}

function messageBlockedResponse(): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "MESSAGE_BLOCKED",
      message: "Message was blocked by moderation."
    }
  };
}

function invalidMessagingRequest(message: string): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}

function accessError(status: "not_found" | "forbidden"): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code: status === "not_found" ? "NOT_FOUND" : "FORBIDDEN",
      message: status === "not_found"
        ? "Conversation was not found."
        : "You do not have access to this conversation."
    }
  };
}
