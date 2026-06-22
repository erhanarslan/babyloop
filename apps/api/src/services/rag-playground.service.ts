import type { RagRuntimeConfig } from "../config/env.js";
import type { RagAssistantService } from "./rag-assistant.service.js";
import { buildRetrievalQuery, type RagQueryAnalysis } from "./rag-query-normalizer.service.js";
import {
  scoreLexicalOverlap,
  scoreSectionMatch,
  scoreSourceReliability,
  scoreTitleMatch,
  scoreTopicMatch
} from "./rag-retrieval-quality.service.js";
import type { RagSearchService } from "./rag-search.service.js";
import type { RagAnswer, RagSearchResult } from "./rag.types.js";

export type RagPlaygroundMode = "search" | "answer";

export type RagPlaygroundInput = {
  query: string;
  mode?: RagPlaygroundMode;
  limit?: number;
  debug?: boolean;
};

export type RagPlaygroundQueryInfo = {
  original: string;
  normalized: string;
  retrievalQuery: string;
  tokens: string[];
  productTerms: string[];
  ageSignals: string[];
  locationSignals: string[];
  topicHints: string[];
};

export type RagPlaygroundDiagnosticResult = {
  rank: number;
  score: number;
  vectorScore: number;
  finalScore: number;
  title: string;
  section?: string;
  topic?: string;
  sourceReliability?: string;
  sourcePath: string;
  textPreview: string;
  qualitySignals: {
    lexicalScore: number;
    titleMatch: boolean;
    sectionMatch: boolean;
    topicMatch: boolean;
    sourceReliabilityBonus: number;
    duplicatePenalty: number;
  };
};

export type RagPlaygroundResponse = {
  query: RagPlaygroundQueryInfo;
  mode: RagPlaygroundMode;
  diagnostics: {
    noSource: boolean;
    minScore: number;
    hybridEnabled: boolean;
    limit: number;
    warnings: string[];
  };
  results: RagPlaygroundDiagnosticResult[];
  answerPreview: null | {
    answer: string;
    mode: RagAnswer["mode"];
    grounded: boolean;
    sources: RagAnswer["sources"];
    intent?: RagAnswer["intent"];
    toolsUsed?: string[];
    toolResultsPreview?: RagAnswer["toolResultsPreview"];
    suggestedActions?: RagAnswer["suggestedActions"];
  };
};

type DiagnosticSearchResult = RagSearchResult & {
  lexicalScore?: number;
  vectorScore?: number;
};

export class RagPlaygroundService {
  private readonly assistantService: Pick<RagAssistantService, "answerMessage"> | null;
  private readonly config: RagRuntimeConfig;
  private readonly searchService: Pick<RagSearchService, "search"> | null;

  constructor(options: {
    assistantService?: Pick<RagAssistantService, "answerMessage"> | null;
    config: RagRuntimeConfig;
    searchService?: Pick<RagSearchService, "search"> | null;
  }) {
    this.assistantService = options.assistantService ?? null;
    this.config = options.config;
    this.searchService = options.searchService ?? null;
  }

  async query(input: RagPlaygroundInput): Promise<RagPlaygroundResponse> {
    const config = this.config;

    if (!config.enabled || !this.searchService) {
      throw new Error("RAG playground is unavailable.");
    }

    const mode = input.mode ?? "search";
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
    const analysis = buildRetrievalQuery(input.query);
    const results = await this.searchService.search(input.query, limit);
    const warnings: string[] = [];

    if (mode === "answer") {
      warnings.push("Cevap önizlemesi gerçek model çağrısı yapabilir ve kota kullanabilir.");
    }

    if (results.length === 0) {
      warnings.push("Bu sorgu için yeterli kaynak bulunamadı.");
    }

    const answer = mode === "answer"
      ? await this.answer(input.query, warnings)
      : null;

    return {
      query: mapQueryInfo(analysis),
      mode,
      diagnostics: {
        noSource: results.length === 0,
        minScore: config.noSourceMinScore,
        hybridEnabled: config.hybridEnabled,
        limit,
        warnings
      },
      results: results.map((result, index) => mapDiagnosticResult(result as DiagnosticSearchResult, analysis, config, index)),
      answerPreview: answer
    };
  }

  private async answer(query: string, warnings: string[]): Promise<RagPlaygroundResponse["answerPreview"]> {
    if (!this.assistantService) {
      warnings.push("Cevap önizlemesi için RAG asistan servisi yapılandırılmadı.");
      return null;
    }

    const answer = await this.assistantService.answerMessage({
      message: query,
      locale: "tr"
    });

    return {
      answer: answer.answer,
      mode: answer.mode,
      grounded: answer.grounded,
      sources: answer.sources,
      ...(answer.intent ? { intent: answer.intent } : {}),
      ...(answer.toolsUsed?.length ? { toolsUsed: answer.toolsUsed } : {}),
      ...(answer.toolResultsPreview?.length ? { toolResultsPreview: answer.toolResultsPreview } : {}),
      ...(answer.suggestedActions?.length ? { suggestedActions: answer.suggestedActions } : {})
    };
  }
}

function mapQueryInfo(analysis: RagQueryAnalysis): RagPlaygroundQueryInfo {
  return {
    original: analysis.originalQuery,
    normalized: analysis.normalizedQuery,
    retrievalQuery: analysis.retrievalQuery,
    tokens: analysis.tokens,
    productTerms: analysis.productTerms,
    ageSignals: analysis.ageSignals,
    locationSignals: analysis.locationSignals,
    topicHints: analysis.topicHints
  };
}

function mapDiagnosticResult(
  result: DiagnosticSearchResult,
  analysis: RagQueryAnalysis,
  config: Extract<RagRuntimeConfig, { enabled: true }>,
  index: number
): RagPlaygroundDiagnosticResult {
  const vectorScore = result.vectorScore ?? result.score;
  const lexicalScore = result.lexicalScore ?? scoreLexicalOverlap(analysis, result);
  const titleMatch = scoreTitleMatch(analysis, result) > 0;
  const sectionMatch = scoreSectionMatch(analysis, result) > 0;
  const topicMatch = scoreTopicMatch(analysis, result) > 0;
  const sourceReliabilityBonus = Number((scoreSourceReliability(analysis, result) * config.sourceReliabilityBonus).toFixed(4));

  return {
    rank: index + 1,
    score: result.score,
    vectorScore,
    finalScore: result.score,
    title: result.citation.title,
    ...(result.citation.section ? { section: result.citation.section } : {}),
    ...(result.citation.topic ? { topic: result.citation.topic } : {}),
    ...(result.citation.sourceReliability ? { sourceReliability: result.citation.sourceReliability } : {}),
    sourcePath: result.citation.sourcePath,
    textPreview: previewText(result.text, config.governanceTextPreviewChars),
    qualitySignals: {
      lexicalScore,
      titleMatch,
      sectionMatch,
      topicMatch,
      sourceReliabilityBonus,
      duplicatePenalty: 0
    }
  };
}

function previewText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxChars - 1, 1)).trim()}…`;
}
