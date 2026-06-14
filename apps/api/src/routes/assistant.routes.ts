import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  assistantChatBodySchema,
  type AssistantChatBody
} from "../schemas/assistant.schemas.js";
import {
  createAssistantChatReply,
  type AssistantChatReply
} from "../services/assistant-chat.service.js";

type AssistantChatResponse = ApiResponse<{
  reply: AssistantChatReply;
}>;

export function registerAssistantRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: AssistantChatResponse | ApiFailure }>(
    "/assistant/chat",
    async (request, reply) => {
      const parsedBody = assistantChatBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_ASSISTANT_CHAT_REQUEST",
            message: "Assistant chat request is invalid."
          }
        });
      }

      return {
        ok: true,
        data: {
          reply: createAssistantChatReply(parsedBody.data as AssistantChatBody)
        }
      };
    }
  );
}
