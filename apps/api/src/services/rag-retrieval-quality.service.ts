import type { RagQueryAnalysis } from "./rag-query-normalizer.service.js";
import type { RagSearchResult } from "./rag.types.js";

export type RagRetrievalQualityConfig = {
  duplicatePenalty: number;
  hybridEnabled: boolean;
  lexicalScoreWeight: number;
  minSourceCoverage: number;
  noSourceMinScore: number;
  sectionMatchBonus: number;
  sourceReliabilityBonus: number;
  titleMatchBonus: number;
  topicMatchBonus: number;
  vectorScoreWeight: number;
};

type ScoredResult = RagSearchResult & {
  lexicalScore: number;
  vectorScore: number;
};

export function scoreLexicalOverlap(queryAnalysis: RagQueryAnalysis, result: RagSearchResult): number {
  if (queryAnalysis.tokens.length === 0) {
    return 0;
  }

  const haystack = searchableText(result);
  const matches = queryAnalysis.tokens.filter((token) => haystack.includes(token));

  return matches.length / queryAnalysis.tokens.length;
}

export function scoreTitleMatch(queryAnalysis: RagQueryAnalysis, result: RagSearchResult): number {
  const title = normalizeText(result.citation.title);
  return queryAnalysis.productTerms.some((term) => title.includes(normalizeText(term))) ||
    queryAnalysis.topicHints.some((hint) => title.includes(normalizeText(hint)))
    ? 1
    : 0;
}

export function scoreSectionMatch(queryAnalysis: RagQueryAnalysis, result: RagSearchResult): number {
  const section = normalizeText(result.citation.section ?? "");
  return queryAnalysis.productTerms.some((term) => section.includes(normalizeText(term))) ||
    queryAnalysis.topicHints.some((hint) => section.includes(normalizeText(hint)))
    ? 1
    : 0;
}

export function scoreTopicMatch(queryAnalysis: RagQueryAnalysis, result: RagSearchResult): number {
  if (!result.citation.topic) {
    return 0;
  }

  return queryAnalysis.topicHints.includes(result.citation.topic) || relatedTopicHints(queryAnalysis).has(result.citation.topic)
    ? 1
    : 0;
}

export function scoreSourceReliability(queryAnalysis: RagQueryAnalysis, result: RagSearchResult): number {
  const reliability = result.citation.sourceReliability;

  if (!reliability) {
    return 0;
  }

  const hints = relatedTopicHints(queryAnalysis);
  const topic = result.citation.topic ?? "";

  if (reliability === "internal-policy") {
    return hints.has("assistant-boundaries") || topic.includes("policy") ? 1 : 0.25;
  }

  if (reliability === "official-source-note") {
    return hints.has("recall-safety") || hints.has("second-hand-risk") || topic.includes("safety") ? 1 : 0.45;
  }

  if (reliability === "internal") {
    return hints.has("marketplace-usage") || hints.has("messaging-privacy") || hints.has("dispute-reporting") ? 0.9 : 0.55;
  }

  if (reliability === "editorial") {
    return hints.has("product-buying") || hints.has("age-based-needs") || hints.has("seasonal-needs") ? 0.85 : 0.45;
  }

  return 0;
}

export function applyDuplicatePenalty(results: RagSearchResult[], config: Pick<RagRetrievalQualityConfig, "duplicatePenalty">): RagSearchResult[] {
  const seenSections = new Set<string>();

  return results.map((result) => {
    const key = sourceSectionKey(result);

    if (seenSections.has(key)) {
      return {
        ...result,
        score: Math.max(0, result.score - config.duplicatePenalty)
      };
    }

    seenSections.add(key);
    return result;
  });
}

export function applyHybridRerank(
  results: RagSearchResult[],
  queryAnalysis: RagQueryAnalysis,
  config: RagRetrievalQualityConfig
): RagSearchResult[] {
  if (!config.hybridEnabled) {
    return stableSort(results);
  }

  const penalized = applyDuplicatePenalty(results, config);

  return penalized
    .map((result, index): { index: number; result: ScoredResult } => {
      const lexicalScore = scoreLexicalOverlap(queryAnalysis, result);
      const finalScore =
        result.score * config.vectorScoreWeight +
        lexicalScore * config.lexicalScoreWeight +
        scoreTitleMatch(queryAnalysis, result) * config.titleMatchBonus +
        scoreSectionMatch(queryAnalysis, result) * config.sectionMatchBonus +
        scoreTopicMatch(queryAnalysis, result) * config.topicMatchBonus +
        scoreSourceReliability(queryAnalysis, result) * config.sourceReliabilityBonus;

      return {
        index,
        result: {
          ...result,
          vectorScore: result.score,
          lexicalScore,
          score: clampScore(finalScore)
        }
      };
    })
    .sort((left, right) => right.result.score - left.result.score || left.index - right.index)
    .map(({ result }) => result);
}

export function collapseDuplicateSources(
  results: RagSearchResult[],
  config: { limit: number; maxSourcesPerDocument: number }
): RagSearchResult[] {
  const sectionKeys = new Set<string>();
  const documentCounts = new Map<string, number>();
  const collapsed: RagSearchResult[] = [];

  for (const result of results) {
    const documentKey = result.citation.sourcePath;
    const sectionKey = sourceSectionKey(result);
    const documentCount = documentCounts.get(documentKey) ?? 0;

    if (sectionKeys.has(sectionKey) || documentCount >= config.maxSourcesPerDocument) {
      continue;
    }

    sectionKeys.add(sectionKey);
    documentCounts.set(documentKey, documentCount + 1);
    collapsed.push(result);

    if (collapsed.length >= config.limit) {
      break;
    }
  }

  return collapsed;
}

export function shouldFallbackNoSource(
  results: RagSearchResult[],
  queryAnalysis: RagQueryAnalysis,
  config: Pick<RagRetrievalQualityConfig, "minSourceCoverage" | "noSourceMinScore">
): boolean {
  if (results.length === 0) {
    return true;
  }

  const coveredResults = results.filter((result) => result.score >= config.noSourceMinScore);

  if (coveredResults.length < config.minSourceCoverage) {
    return true;
  }

  const best = results[0];

  if (!best || best.score < config.noSourceMinScore) {
    return true;
  }

  if (hasUnsupportedSpecificTerms(queryAnalysis, best)) {
    return true;
  }

  const hasAnySignal = scoreLexicalOverlap(queryAnalysis, best) > 0 || scoreTopicMatch(queryAnalysis, best) > 0;

  return !hasAnySignal;
}

function relatedTopicHints(queryAnalysis: RagQueryAnalysis): Set<string> {
  const hints = new Set(queryAnalysis.topicHints);

  for (const product of queryAnalysis.productTerms) {
    if (product === "bebek arabası") {
      hints.add("product-buying");
      hints.add("stroller-safety");
    }

    if (product === "oto koltuğu") {
      hints.add("car-seat-safety");
      hints.add("second-hand-risk");
    }

    if (product === "oyuncak") {
      hints.add("toy-safety");
    }
  }

  return hints;
}

function searchableText(result: RagSearchResult): string {
  return normalizeText([
    result.text,
    result.citation.title,
    result.citation.section ?? "",
    result.citation.topic ?? "",
    result.citation.sourceReliability ?? ""
  ].join(" "));
}

function hasUnsupportedSpecificTerms(queryAnalysis: RagQueryAnalysis, result: RagSearchResult): boolean {
  const specificTerms = queryAnalysis.tokens.filter((token) => [
    "component",
    "kuantum",
    "react",
    "server",
    "sertifika",
    "sertifikası"
  ].includes(token));

  if (specificTerms.length === 0) {
    return false;
  }

  const haystack = searchableText(result);
  return specificTerms.some((term) => !haystack.includes(term));
}

function normalizeText(value: string): string {
  return value.normalize("NFC").trim().toLocaleLowerCase("tr").replace(/\s+/gu, " ");
}

function stableSort(results: RagSearchResult[]): RagSearchResult[] {
  return results
    .map((result, index) => ({ result, index }))
    .sort((left, right) => right.result.score - left.result.score || left.index - right.index)
    .map(({ result }) => result);
}

function sourceSectionKey(result: RagSearchResult): string {
  return `${result.citation.sourcePath}:${result.citation.section ?? ""}`;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}
