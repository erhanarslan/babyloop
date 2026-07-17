import type {
  AssistantMessageInput,
  RagGroundedAnswerProvider
} from "@babyloop/ai-core";
import { redactPii } from "./rag-pii-redaction.service.js";
import { decideRagSafety } from "./rag-safety.service.js";
import { type AssistantIntent, routeAssistantIntent } from "./assistant-intent-router.service.js";
import type { RagAnswer, RagCitation } from "./rag.types.js";
import type { RagSearchService } from "./rag-search.service.js";
import { policyFromAnswerOwner } from "./rag-search.service.js";
import type { RagCacheService } from "./rag-cache.service.js";
import type { AssistantToolContext } from "./assistant-tools.types.js";
import { AssistantToolOrchestrator } from "./assistant-tool-orchestrator.service.js";
import { getRagAnswerOwnerPolicy, RAG_OWNER_REGISTRY_VERSION } from "./rag-answer-owner-registry.js";
import { RAG_DOMAIN_ROUTER_VERSION, routeRagDomain, type RagDomainDecision } from "./rag-domain-router.service.js";
import { validateRagAnswerGrounding } from "./rag-answer-grounding-validator.service.js";

export type RagAssistantServiceOptions = {
  answerProvider: RagGroundedAnswerProvider;
  cacheService?: RagCacheService;
  cacheVersion?: string;
  maxContextChars: number;
  requireSources: boolean;
  searchService: RagSearchService;
  toolsEnabled?: boolean;
  maxToolCalls?: number;
  toolTimeoutMs?: number;
};

const NO_SOURCE_ANSWER =
  "Bu konuda BabyLoop bilgi tabanında yeterli kaynak bulamadım. BabyLoop içindeki güvenli alışveriş, ilan hazırlama, ürün kontrol listeleri ve BabyLoop kullanımı hakkında yardımcı olabilirim.";

const TOOL_CACHE_BYPASS_INTENTS = new Set<AssistantIntent>([
  "listing_search",
  "listing_detail",
  "listing_help",
  "buyer_questions",
  "saved_search_suggestion",
  "category_lookup",
  "seller_summary",
  "child_needs"
]);

function shouldBypassAssistantAnswerCache(intent: AssistantIntent, toolsEnabled: boolean): boolean {
  return toolsEnabled && TOOL_CACHE_BYPASS_INTENTS.has(intent);
}

export class RagAssistantService {
  private readonly answerProvider: RagGroundedAnswerProvider;
  private readonly cacheService: RagCacheService | undefined;
  private readonly cacheVersion: string;
  private readonly maxContextChars: number;
  private readonly requireSources: boolean;
  private readonly searchService: RagSearchService;
  private readonly toolsEnabled: boolean;
  private readonly toolOrchestrator: AssistantToolOrchestrator;

  constructor(options: RagAssistantServiceOptions) {
    this.answerProvider = options.answerProvider;
    this.cacheService = options.cacheService;
    this.cacheVersion = options.cacheVersion ?? "rag-index-unversioned";
    this.maxContextChars = options.maxContextChars;
    this.requireSources = options.requireSources;
    this.searchService = options.searchService;
    this.toolsEnabled = options.toolsEnabled ?? true;
    this.toolOrchestrator = new AssistantToolOrchestrator({
      maxToolCalls: options.maxToolCalls ?? 3,
      timeoutMs: options.toolTimeoutMs ?? 1_500
    });
  }

  async answerMessage(input: AssistantMessageInput, toolContext: AssistantToolContext = {}): Promise<RagAnswer> {
    const redacted = redactPii(input.message);
    const domainDecision = routeRagDomain(redacted.redactedText);
    const intentDecision = routeAssistantIntent(redacted.redactedText);
    const safety = decideRagSafety(redacted.redactedText);
    const shouldBypassCache = shouldBypassAssistantAnswerCache(intentDecision.intent, this.toolsEnabled);
    const cacheKey = shouldBypassCache
      ? undefined
      : this.cacheService?.buildKey({
          intent: intentDecision.intent,
          locale: input.locale ?? "tr",
          message: redacted.redactedText,
          version: `${this.cacheVersion}:${RAG_DOMAIN_ROUTER_VERSION}:${RAG_OWNER_REGISTRY_VERSION}:${domainDecision.domain}:${domainDecision.canonicalOwner ?? "none"}`
        });
    const cached = cacheKey ? await this.cacheService?.get(cacheKey) : null;

    if (cached) {
      return cached;
    }

    if (!safety.allowed) {
      return this.cacheAndReturn(cacheKey, {
        answer: safety.boundaryAnswer ?? NO_SOURCE_ANSWER,
        sources: [],
        mode: "boundary",
        grounded: false,
        intent: intentDecision.intent,
        domain: domainDecision.domain,
        routeConfidence: domainDecision.confidence,
        groundingStatus: "blocked_safety"
      });
    }

    if (this.toolsEnabled) {
      const toolAnswer = await this.toolOrchestrator.orchestrate({
        context: {
          ragSearch: (query, limit, options) => this.searchService.search(query, limit, options),
          ...toolContext
        },
        domainDecision,
        intent: intentDecision.intent,
        message: redacted.redactedText
      });

      if (toolAnswer.handled && toolAnswer.answer) {
        return this.cacheAndReturn(cacheKey, {
          answer: toolAnswer.answer.answer,
          sources: toolAnswer.answer.sources,
          mode: toolAnswer.answer.mode ?? (toolAnswer.answer.grounded ? "rag" : "no_sources"),
          grounded: toolAnswer.answer.grounded,
          intent: intentDecision.intent,
          domain: domainDecision.domain,
          routeConfidence: domainDecision.confidence,
          groundingStatus: toolAnswer.answer.grounded ? "grounded" : "insufficient_sources",
          sourceOwner: domainDecision.canonicalOwner ?? undefined,
          ...(toolAnswer.answer.toolsUsed?.length ? { toolsUsed: toolAnswer.answer.toolsUsed } : {}),
          ...(toolAnswer.answer.toolResultsPreview?.length ? { toolResultsPreview: toolAnswer.answer.toolResultsPreview } : {}),
          ...(toolAnswer.answer.suggestedActions?.length ? { suggestedActions: toolAnswer.answer.suggestedActions } : {})
        });
      }
    }

    const searchPolicy = policyFromAnswerOwner(getRagAnswerOwnerPolicy(domainDecision.domain));
    const results = await this.searchService.search(redacted.redactedText, undefined, searchPolicy);

    if (results.length === 0 && this.requireSources) {
      return this.cacheAndReturn(cacheKey, {
        answer: noSourceAnswerForDomain(domainDecision),
        sources: [],
        mode: "no_sources",
        grounded: false,
        intent: intentDecision.intent,
        domain: domainDecision.domain,
        routeConfidence: domainDecision.confidence,
        groundingStatus: domainDecision.requireCanonicalOwner ? "owner_missing" : "insufficient_sources",
        blockedReason: "insufficient_sources",
        sourceOwner: domainDecision.canonicalOwner ?? undefined,
        retrievalDiagnosticsSummary: {
          canonicalOwnerFound: false,
          crossDomainContamination: false,
          rejectedReasons: ["no_policy_matching_sources"],
          selectedSourceTopics: []
        }
      });
    }

    const limitedSources = limitContext(results, this.maxContextChars);
    const limitedCitations = uniqueCitations(limitedSources.map((result) => result.citation));
    const deterministicAnswer = buildDeterministicCanonicalAnswer(redacted.redactedText, domainDecision, limitedCitations);

    if (deterministicAnswer) {
      return this.cacheAndReturn(cacheKey, {
        answer: deterministicAnswer,
        sources: limitedCitations,
        mode: "rag",
        grounded: true,
        intent: intentDecision.intent,
        domain: domainDecision.domain,
        routeConfidence: domainDecision.confidence,
        groundingStatus: "grounded",
        sourceOwner: domainDecision.canonicalOwner ?? undefined,
        sourceReliability: limitedCitations[0]?.sourceReliability,
        citationCoverage: 1,
        retrievalDiagnosticsSummary: {
          canonicalOwnerFound: true,
          crossDomainContamination: false,
          rejectedReasons: [],
          selectedSourceTopics: limitedCitations.map((citation) => citation.topic).filter((topic): topic is string => Boolean(topic))
        }
      });
    }

    const answer = await this.answerProvider.answerWithSources({
      message: redacted.redactedText,
      locale: input.locale ?? "tr",
      sources: limitedSources.map((result) => ({
        ...result.citation,
        text: result.text
      }))
    });
    const validation = validateRagAnswerGrounding({
      answer: answer.answer,
      citations: limitedCitations,
      domainDecision
    });

    if (!validation.allowed && this.requireSources) {
      return this.cacheAndReturn(cacheKey, {
        answer: noSourceAnswerForDomain(domainDecision),
        sources: [],
        mode: "no_sources",
        grounded: false,
        intent: intentDecision.intent,
        domain: domainDecision.domain,
        routeConfidence: domainDecision.confidence,
        groundingStatus: validation.status === "grounded" ? "insufficient_sources" : validation.status,
        blockedReason: validation.rejectedReasons.join(","),
        sourceOwner: domainDecision.canonicalOwner ?? undefined,
        retrievalDiagnosticsSummary: {
          canonicalOwnerFound: false,
          crossDomainContamination: validation.status === "cross_domain_contamination",
          rejectedReasons: validation.rejectedReasons,
          selectedSourceTopics: limitedCitations.map((citation) => citation.topic).filter((topic): topic is string => Boolean(topic))
        }
      });
    }

    return this.cacheAndReturn(cacheKey, {
      answer: answer.answer,
      sources: limitedCitations,
      mode: "rag",
      grounded: true,
      intent: intentDecision.intent,
      domain: domainDecision.domain,
      routeConfidence: domainDecision.confidence,
      groundingStatus: "grounded",
      sourceOwner: domainDecision.canonicalOwner ?? undefined,
      sourceReliability: limitedCitations[0]?.sourceReliability,
      citationCoverage: 1,
      retrievalDiagnosticsSummary: {
        canonicalOwnerFound: !domainDecision.requireCanonicalOwner || limitedCitations.some((citation) => citation.answerOwner === domainDecision.canonicalOwner || citation.sourcePath === domainDecision.allowedSourcePaths[0]),
        crossDomainContamination: false,
        rejectedReasons: [],
        selectedSourceTopics: limitedCitations.map((citation) => citation.topic).filter((topic): topic is string => Boolean(topic))
      }
    });
  }

  private async cacheAndReturn(cacheKey: string | undefined, answer: RagAnswer): Promise<RagAnswer> {
    if (cacheKey) {
      await this.cacheService?.set(cacheKey, answer);
    }

    return answer;
  }
}

function noSourceAnswerForDomain(domainDecision: RagDomainDecision): string {
  if (domainDecision.domain === "feeding") {
    return "Bu ek gıda sorusu için BabyLoop bilgi tabanında uygun canonical beslenme kaynağı bulunamadı. Alakasız kaynaklara dayanarak yanıt veremem.";
  }

  return NO_SOURCE_ANSWER;
}

function buildDeterministicCanonicalAnswer(message: string, domainDecision: RagDomainDecision, citations: RagCitation[]): string | null {
  if (domainDecision.domain !== "feeding") {
    return null;
  }

  const canonicalSourcePath = domainDecision.allowedSourcePaths[0];
  const hasCanonicalFeedingSource = citations.some((citation) =>
    citation.sourcePath === canonicalSourcePath ||
    citation.answerOwner === "feeding-and-food-safety-canon"
  );

  if (!hasCanonicalFeedingSource) {
    return null;
  }

  const normalizedMessage = message.toLocaleLowerCase("tr");
  const agePrefix = /(?:6|alt[ıi])\s+ay/iu.test(normalizedMessage)
    ? "6 ay civarında ek gıda sorularında"
    : "Ek gıda sorularında";

  return `${agePrefix} BabyLoop yanıtı yalnız feeding-food-safety kaynağına dayanır: ek gıda genel bir ek beslenme geçişidir; kişisel yemek planı veya hastalıkta beslenme planı değildir. Genel çerçevede aileler uygun dokuda tek tek gıda denemeleri, bal/tuz/şeker sınırları, hijyen ve boğulma riski gibi gıda güvenliği başlıklarını kontrol etmelidir. Bebeğin hastalığı, alerji şüphesi, kilo yönetimi veya özel sağlık durumu varsa BabyLoop kişisel beslenme planı vermez.`;
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
