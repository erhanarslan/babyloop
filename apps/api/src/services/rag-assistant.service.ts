import type {
  AssistantMessageInput,
  RagGroundedAnswerProvider
} from "@babyloop/ai-core";
import { redactPii } from "./rag-pii-redaction.service.js";
import { decideRagSafety } from "./rag-safety.service.js";
import { routeAssistantIntent } from "./assistant-intent-router.service.js";
import type { RagAnswer, RagCitation } from "./rag.types.js";
import type { RagSearchService } from "./rag-search.service.js";
import type { RagCacheService } from "./rag-cache.service.js";

export type RagAssistantServiceOptions = {
  answerProvider: RagGroundedAnswerProvider;
  cacheService?: RagCacheService;
  maxContextChars: number;
  requireSources: boolean;
  searchService: RagSearchService;
};

const NO_SOURCE_ANSWER =
  "Bu konuda BabyLoop bilgi tabanında yeterli kaynak bulamadım. İlan hazırlama, güvenli alışveriş, ürün kontrol listeleri veya BabyLoop kullanımı hakkında daha net bir soru sorabilirsin.";

export class RagAssistantService {
  private readonly answerProvider: RagGroundedAnswerProvider;
  private readonly cacheService: RagCacheService | undefined;
  private readonly maxContextChars: number;
  private readonly requireSources: boolean;
  private readonly searchService: RagSearchService;

  constructor(options: RagAssistantServiceOptions) {
    this.answerProvider = options.answerProvider;
    this.cacheService = options.cacheService;
    this.maxContextChars = options.maxContextChars;
    this.requireSources = options.requireSources;
    this.searchService = options.searchService;
  }

  async answerMessage(input: AssistantMessageInput): Promise<RagAnswer> {
    const redacted = redactPii(input.message);
    const intentDecision = routeAssistantIntent(redacted.redactedText);
    const safety = decideRagSafety(redacted.redactedText);
    const cacheKey = this.cacheService?.buildKey({
      intent: intentDecision.intent,
      locale: input.locale ?? "tr",
      message: redacted.redactedText
    });
    const cached = cacheKey ? this.cacheService?.get(cacheKey) : null;

    if (cached) {
      return cached;
    }

    if (!safety.allowed) {
      return this.cacheAndReturn(cacheKey, {
        answer: safety.boundaryAnswer ?? NO_SOURCE_ANSWER,
        sources: [],
        mode: "boundary",
        grounded: false,
        intent: intentDecision.intent
      });
    }

    if (intentDecision.intent === "listing_search") {
      const params = new URLSearchParams({ q: redacted.redactedText });

      return this.cacheAndReturn(cacheKey, {
        answer: `İlan araması için arama sayfasını kullanabilirsin: /browse?${params.toString()}`,
        sources: [],
        mode: "no_sources",
        grounded: false,
        intent: intentDecision.intent,
        toolsUsed: ["listing_search"]
      });
    }

    const results = await this.searchService.search(redacted.redactedText);

    if (results.length === 0 && this.requireSources) {
      return this.cacheAndReturn(cacheKey, {
        answer: NO_SOURCE_ANSWER,
        sources: [],
        mode: "no_sources",
        grounded: false,
        intent: intentDecision.intent
      });
    }

    const limitedSources = limitContext(results, this.maxContextChars);
    const answer = await this.answerProvider.answerWithSources({
      message: redacted.redactedText,
      locale: input.locale ?? "tr",
      sources: limitedSources.map((result) => ({
        ...result.citation,
        text: result.text
      }))
    });

    return this.cacheAndReturn(cacheKey, {
      answer: answer.answer,
      sources: uniqueCitations(limitedSources.map((result) => result.citation)),
      mode: "rag",
      grounded: true,
      intent: intentDecision.intent
    });
  }

  private cacheAndReturn(cacheKey: string | undefined, answer: RagAnswer): RagAnswer {
    if (cacheKey) {
      this.cacheService?.set(cacheKey, answer);
    }

    return answer;
  }
}

function limitContext<T extends { text: string }>(results: T[], maxContextChars: number): T[] {
  const limited: T[] = [];
  let usedChars = 0;

  for (const result of results) {
    if (usedChars + result.text.length > maxContextChars && limited.length > 0) {
      break;
    }

    limited.push(result);
    usedChars += result.text.length;
  }

  return limited;
}

function uniqueCitations(citations: RagCitation[]): RagCitation[] {
  const seen = new Set<string>();
  const unique: RagCitation[] = [];

  for (const citation of citations) {
    const key = `${citation.sourcePath}:${citation.section ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(citation);
  }

  return unique;
}
