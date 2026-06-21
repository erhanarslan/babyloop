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
import type { RagAssistantService } from "../services/rag-assistant.service.js";
import type { RagCitation } from "../services/rag.types.js";
import type { AssistantIntent } from "../services/assistant-intent-router.service.js";
import type { AssistantListingSearchResult } from "../services/assistant-tools.types.js";
import type { RagUsageLimitService } from "../services/rag-usage-limits.service.js";
import type { RagMetricsService } from "../services/rag-metrics.service.js";

type AssistantChatResponse = ApiResponse<{
  reply: AssistantChatReply;
}>;

type AssistantMessageResponse = ApiResponse<{
  answer: string;
  actions?: AssistantMessageOutput["actions"];
  sources?: RagCitation[];
  mode?: "rag" | "boundary" | "no_sources";
  grounded?: boolean;
  intent?: AssistantIntent;
  toolsUsed?: string[];
}>;

type AssistantRouteOptions = {
  assistantProvider?: AssistantMessageProvider | null;
  listingSearch?: (input: { query: string; city?: string; limit?: number }) => Promise<AssistantListingSearchResult[]>;
  ragMetricsService?: RagMetricsService | null;
  ragAssistantService?: RagAssistantService | null;
  ragUsageLimitService?: RagUsageLimitService | null;
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

      const ragAssistantService = options.ragAssistantService ?? null;

      if (ragAssistantService) {
        try {
          await options.ragMetricsService?.recordRequest("assistant");
          const usage = await options.ragUsageLimitService?.consume({
            authenticated: Boolean(request.currentUser),
            currentUser: request.currentUser,
            identifier: request.ip,
            scope: "assistant"
          });

          if (usage && !usage.allowed) {
            await options.ragMetricsService?.recordRateLimited();
            if (usage.retryAfterSeconds) {
              reply.header("Retry-After", String(usage.retryAfterSeconds));
            }
            return reply.status(429).send({
              ok: false,
              error: {
                code: "RAG_USAGE_LIMIT_EXCEEDED",
                message: "Asistan kullanım sınırına ulaşıldı. Daha sonra tekrar deneyebilirsin."
              }
            });
          }

          const answer = await ragAssistantService.answerMessage(parsedBody.data);
          const listingAnswer = answer.intent === "listing_search" && options.listingSearch
            ? await buildListingSearchAnswer(parsedBody.data.message, options.listingSearch)
            : null;

          await options.ragMetricsService?.recordAnswer({
            ...answer,
            ...(listingAnswer ? { toolsUsed: listingAnswer.toolsUsed } : {})
          });
          if (!answer.cacheHit) {
            await options.ragMetricsService?.recordCacheMiss();
          }

          return {
            ok: true,
            data: {
              answer: listingAnswer?.answer ?? answer.answer,
              mode: answer.mode,
              grounded: answer.grounded,
              ...(answer.intent ? { intent: answer.intent } : {}),
              ...(answer.sources.length > 0 ? { sources: answer.sources } : {}),
              ...((listingAnswer?.toolsUsed ?? answer.toolsUsed)?.length
                ? { toolsUsed: listingAnswer?.toolsUsed ?? answer.toolsUsed }
                : {})
            }
          };
        } catch {
          await options.ragMetricsService?.recordError();
          return reply.status(503).send({
            ok: false,
            error: {
              code: "ASSISTANT_UNAVAILABLE",
              message: "Asistan şu an yapılandırılmadı. Daha sonra tekrar deneyebilirsin."
            }
          });
        }
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

async function buildListingSearchAnswer(
  query: string,
  listingSearch: NonNullable<AssistantRouteOptions["listingSearch"]>
): Promise<{ answer: string; toolsUsed: string[] }> {
  const results = await listingSearch({
    query,
    limit: 5
  });
  const params = new URLSearchParams({ q: query.trim() });
  const browseHref = `/browse?${params.toString()}`;

  if (results.length === 0) {
    return {
      answer: `Bu sorguya uygun ilan bulamadım. Aramayı genişletmek için ${browseHref} sayfasını kullanabilirsin.`,
      toolsUsed: ["listing_search"]
    };
  }

  const lines = results.slice(0, 5).map((listing) => {
    const details = [
      listing.price,
      listing.category,
      listing.condition,
      listing.city
    ].filter(Boolean).join(" · ");

    return `- ${listing.title}${details ? ` · ${details}` : ""} (${listing.href})`;
  });

  return {
    answer: `Bulduğum bazı ilanlar:\n${lines.join("\n")}\n\nDaha fazla sonuç için ${browseHref} sayfasına bakabilirsin.`,
    toolsUsed: ["listing_search"]
  };
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
