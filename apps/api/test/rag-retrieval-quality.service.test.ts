import { describe, expect, it } from "vitest";
import { buildRetrievalQuery } from "../src/services/rag-query-normalizer.service.js";
import {
  applyHybridRerank,
  collapseDuplicateSources,
  scoreLexicalOverlap,
  scoreSourceReliability,
  scoreTopicMatch,
  shouldFallbackNoSource
} from "../src/services/rag-retrieval-quality.service.js";
import type { RagSearchResult } from "../src/services/rag.types.js";

const baseConfig = {
  duplicatePenalty: 0.05,
  hybridEnabled: true,
  lexicalScoreWeight: 0.18,
  minSourceCoverage: 1,
  noSourceMinScore: 0.68,
  sectionMatchBonus: 0.03,
  sourceReliabilityBonus: 0.02,
  titleMatchBonus: 0.04,
  topicMatchBonus: 0.03,
  vectorScoreWeight: 1
};

describe("rag retrieval quality service", () => {
  it("scores lexical overlap and topic matches", () => {
    const analysis = buildRetrievalQuery("bebek arabasi alirken nelere bakmaliyim");
    const result = createResult({
      score: 0.72,
      text: "Bebek arabası fren, tekerlek ve katlanma sistemi kontrol edilir.",
      topic: "stroller-safety"
    });

    expect(scoreLexicalOverlap(analysis, result)).toBeGreaterThan(0);
    expect(scoreTopicMatch(analysis, result)).toBe(1);
  });

  it("applies context-aware source reliability bonus", () => {
    const recallAnalysis = buildRetrievalQuery("ürün geri çağırma kontrolü nasıl yapılır");
    const officialSource = createResult({
      score: 0.7,
      sourceReliability: "official-source-note",
      topic: "product-recall"
    });
    const editorialSource = createResult({
      score: 0.7,
      sourceReliability: "editorial",
      topic: "product-recall"
    });

    expect(scoreSourceReliability(recallAnalysis, officialSource)).toBeGreaterThan(scoreSourceReliability(recallAnalysis, editorialSource));
  });

  it("reranks hybrid results with lexical and topic signals", () => {
    const analysis = buildRetrievalQuery("oto koltugu ikinci el alınır mı");
    const ranked = applyHybridRerank(
      [
        createResult({ score: 0.82, text: "Genel BabyLoop kaynak metni.", topic: "marketplace-usage" }),
        createResult({ score: 0.8, text: "Oto koltuğu kaza geçmişi ve etiket bilgisi kontrol edilir.", topic: "car-seat-safety", sourceReliability: "official-source-note" })
      ],
      analysis,
      baseConfig
    );

    expect(ranked[0]?.citation.topic).toBe("car-seat-safety");
  });

  it("collapses duplicate source sections", () => {
    const collapsed = collapseDuplicateSources(
      [
        createResult({ sourcePath: "docs/rag/a.md", section: "Genel", score: 0.9 }),
        createResult({ sourcePath: "docs/rag/a.md", section: "Genel", score: 0.89 }),
        createResult({ sourcePath: "docs/rag/a.md", section: "Detay", score: 0.88 }),
        createResult({ sourcePath: "docs/rag/b.md", section: "Genel", score: 0.87 })
      ],
      {
        limit: 5,
        maxSourcesPerDocument: 2
      }
    );

    expect(collapsed.map((result) => `${result.citation.sourcePath}:${result.citation.section}`)).toEqual([
      "docs/rag/a.md:Genel",
      "docs/rag/a.md:Detay",
      "docs/rag/b.md:Genel"
    ]);
  });

  it("falls back to no-source for irrelevant high-score results", () => {
    const analysis = buildRetrievalQuery("React server component nedir");
    const results = [
      createResult({
        score: 0.92,
        text: "Bebek arabası fren kontrolü kaynak metni.",
        topic: "stroller-safety"
      })
    ];

    expect(shouldFallbackNoSource(results, analysis, baseConfig)).toBe(true);
  });

  it("does not answer specific unsupported certification terms from partial product overlap", () => {
    const analysis = buildRetrievalQuery("BabyLoop kuantum oyuncak sertifikası nedir");
    const results = [
      createResult({
        score: 0.94,
        text: "Oyuncaklarda küçük parça ve yaş etiketi kontrol edilir.",
        topic: "toy-safety"
      })
    ];

    expect(shouldFallbackNoSource(results, analysis, baseConfig)).toBe(true);
  });

  it("scores official-referenced everyday care sources", () => {
    const analysis = buildRetrievalQuery("Ateşi var ne yapayım?");
    const officialSource = createResult({
      score: 0.7,
      sourceReliability: "official-referenced",
      topic: "fever-care"
    });

    expect(scoreSourceReliability(analysis, officialSource)).toBeGreaterThan(0.9);
  });

});

function createResult(input: Partial<{
  score: number;
  section: string;
  sourcePath: string;
  sourceReliability: string;
  text: string;
  topic: string;
}>): RagSearchResult {
  return {
    score: input.score ?? 0.8,
    text: input.text ?? "Kaynak metni.",
    citation: {
      title: "Test kaynak",
      sourcePath: input.sourcePath ?? "docs/rag/test.md",
      section: input.section ?? "Genel",
      topic: input.topic ?? "safe-shopping",
      sourceReliability: input.sourceReliability ?? "editorial"
    }
  };
}
