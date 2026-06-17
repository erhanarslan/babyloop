import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import type {
  AssistantMessageOutput,
  AssistantMessageProvider
} from "@babyloop/ai-core";
import {
  assistantChatBodySchema,
  assistantMessageBodySchema,
  type AssistantChatBody
} from "../schemas/assistant.schemas.js";
import {
  createAssistantChatReply,
  type AssistantChatReply
} from "../services/assistant-chat.service.js";

type AssistantChatResponse = ApiResponse<{
  reply: AssistantChatReply;
}>;

type AssistantMessageResponse = ApiResponse<{
  answer: string;
  actions?: AssistantMessageOutput["actions"];
}>;

type AssistantRouteOptions = {
  assistantProvider?: AssistantMessageProvider | null;
};

export function registerAssistantRoutes(app: FastifyInstance, options: AssistantRouteOptions = {}): void {
  app.post<{ Body: unknown; Reply: AssistantMessageResponse | ApiFailure }>(
    "/assistant/messages",
    async (request, reply) => {
      const parsedBody = assistantMessageBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_ASSISTANT_MESSAGE_REQUEST",
            message: "Asistan isteği geçersiz."
          }
        });
      }

      const provider = options.assistantProvider ?? null;

      if (!provider) {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "ASSISTANT_UNAVAILABLE",
            message: "Asistan şu an yapılandırılmadı. Daha sonra tekrar deneyebilirsin."
          }
        });
      }

      try {
        const answer = await provider.answerMessage(parsedBody.data);

        return {
          ok: true,
          data: {
            answer: answer.answer,
            ...(answer.actions.length > 0 ? { actions: sanitizeActions(answer.actions) } : {})
          }
        };
      } catch {
        return reply.status(503).send({
          ok: false,
          error: {
            code: "ASSISTANT_UNAVAILABLE",
            message: "Asistan şu an yapılandırılmadı. Daha sonra tekrar deneyebilirsin."
          }
        });
      }
    }
  );

  app.post<{ Body: unknown; Reply: AssistantChatResponse | ApiFailure }>(
    "/assistant/chat",
    async (request, reply) => {
      const parsedBody = assistantChatBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_ASSISTANT_CHAT_REQUEST",
            message: "Asistan isteği geçersiz."
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

function sanitizeActions(actions: AssistantMessageOutput["actions"]): AssistantMessageOutput["actions"] {
  return actions
    .filter((action) => action.href.startsWith("/") && !action.href.startsWith("//"))
    .map((action) => ({
      label: action.label.slice(0, 40),
      href: action.href.slice(0, 200)
    }))
    .slice(0, 3);
}
