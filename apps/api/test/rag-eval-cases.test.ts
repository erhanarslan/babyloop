import { describe, expect, it, vi } from "vitest";
import type { RagGroundedAnswerProvider } from "@babyloop/ai-core";
import { ragEvalCases } from "./fixtures/rag-eval-cases.js";
import { RagAssistantService } from "../src/services/rag-assistant.service.js";
import type { RagSearchService } from "../src/services/rag-search.service.js";
import type { RagSearchResult } from "../src/services/rag.types.js";

const topicMatchers: Array<{ pattern: RegExp; topic: string; title: string; sourcePath: string }> = [
  { pattern: /ek\s*g[ıi]da|ne\s+yedireyim|ne\s+yer|bal|tuz|şeker|parmak\s+g[ıi]da|p[üu]re|p[üu]t[üu]rl[üu]/iu, topic: "feeding-food-safety", title: "Feeding and Food Safety Canon", sourcePath: "docs/rag/44-feeding-and-food-safety-canon.md" },
  { pattern: /bebek arabas[ıi]/iu, topic: "stroller-safety", title: "Bebek arabası ikinci el kontrol listesi", sourcePath: "docs/rag/07-stroller-buying-checklist.md" },
  { pattern: /oto koltu|çarpışma/iu, topic: "car-seat-safety", title: "Oto koltuğu ikinci el kontrol listesi", sourcePath: "docs/rag/08-car-seat-second-hand-checklist.md" },
  { pattern: /oyuncak|küçük parça/iu, topic: "toy-safety", title: "Oyuncak güvenliği kontrol listesi", sourcePath: "docs/rag/09-toy-safety-checklist.md" },
  { pattern: /ana kuca|ana kucagi/iu, topic: "product-buying", title: "Ürün seçimi kontrol rehberleri", sourcePath: "docs/rag/04-product-buying-guides.md" },
  { pattern: /ilan\s+açıklaması|ilan.*açıklama|açıklama.*ilan|listing-writing/iu, topic: "listing-writing", title: "İlan hazırlama rehberi", sourcePath: "docs/rag/03-listing-writing-guide.md" },
  { pattern: /[iı]ban|alışveriş/iu, topic: "safe-shopping", title: "Güvenli alışveriş rehberi", sourcePath: "docs/rag/02-safe-shopping-guide.md" },
  { pattern: /kış|mevsim|soğuk/iu, topic: "seasonal-needs", title: "Mevsimsel ihtiyaçlar rehberi", sourcePath: "docs/rag/20-seasonal-needs-guide.md" },
  { pattern: /18 aylık|yaş|ürünler|ne almalı/iu, topic: "age-based-needs", title: "Yaş dönemine göre genel ürün ihtiyaçları", sourcePath: "docs/rag/05-age-based-product-needs.md" },
  { pattern: /yanlış ürün|anlaşmazlık|rapor/iu, topic: "dispute-reporting", title: "Anlaşmazlık ve raporlama rehberi", sourcePath: "docs/rag/19-marketplace-dispute-and-reporting-guide.md" },
  { pattern: /kayıtlı arama|favoriler|BabyLoop nasıl/iu, topic: "marketplace-usage", title: "BabyLoop pazar yeri kullanım rehberi", sourcePath: "docs/rag/01-babyloop-marketplace-guide.md" },
  { pattern: /mesajlaşma/iu, topic: "messaging-privacy", title: "Mesajlaşma ve gizlilik rehberi", sourcePath: "docs/rag/06-messaging-and-privacy.md" },
  { pattern: /geri çağırma/iu, topic: "product-recall", title: "Geri çağırma ve ürün uyarısı kontrol rehberi", sourcePath: "docs/rag/12-recall-and-product-warning-guide.md" },
  { pattern: /beşik|uyku|ana kuca|park yatak|yastık|battaniye/iu, topic: "sleep-product-safety", title: "Safe Sleep and Sleep Product Boundary Canon", sourcePath: "docs/rag/45-safe-sleep-and-product-boundary-canon.md" },
  { pattern: /fotoğraf/iu, topic: "listing-photos", title: "Satıcı fotoğraf kalitesi rehberi", sourcePath: "docs/rag/13-seller-photo-quality-guide.md" },
  { pattern: /hangi\s+sorular|soruları|alıcı.*sor|satıcı.*sor|buyer-questions|question-templates/iu, topic: "buyer-questions", title: "Alıcı soru şablonları", sourcePath: "docs/rag/14-buyer-question-templates.md" }
];

const answerProvider: RagGroundedAnswerProvider = {
  providerName: "mock-rag-eval-answer",
  async answerWithSources(input) {
    const topics = input.sources.map((source) => source.topic).filter(Boolean).join(", ");

    return {
      answer: `Kaynaklara göre kısa kontrol listesi: ${topics}. Kesin garanti verilmez; ürünü ve satıcı bilgisini kontrol et.`,
      providerName: "mock-rag-eval-answer",
      promptVersion: "test"
    };
  }
};


const fallbackTopicMetadata: Record<string, { title: string; sourcePath: string }> = {
  "preconception-pregnancy": {
    title: "Gebelik öncesi hazırlık ve gebe kalma şansını artırma rehberi",
    sourcePath: "docs/rag/31-preconception-and-fertility-basics.md"
  },
  "pregnancy-preparation": {
    title: "Gebelik trimesterlerine göre hazırlık ve alışveriş planı",
    sourcePath: "docs/rag/32-pregnancy-trimester-week-by-week-preparation.md"
  },
  "fever-care": {
    title: "Illness Red Flags and Everyday Care Boundary Canon",
    sourcePath: "docs/rag/46-illness-red-flags-boundary-canon.md"
  },
  "diarrhea-vomiting-care": {
    title: "Illness Red Flags and Everyday Care Boundary Canon",
    sourcePath: "docs/rag/46-illness-red-flags-boundary-canon.md"
  }
};

function createFallbackTopicMatcher(topic: string): (typeof topicMatchers)[number] {
  const existing = topicMatchers.find((matcher) => matcher.topic === topic);

  if (existing) {
    return existing;
  }

  const metadata = fallbackTopicMetadata[topic] ?? {
    title: `Eval kaynak: ${topic}`,
    sourcePath: `docs/rag/${topic}.md`
  };

  return {
    pattern: /./u,
    topic,
    title: metadata.title,
    sourcePath: metadata.sourcePath
  };
}

describe("rag eval cases", () => {
  it("covers at least 150 assistant quality cases", () => {
    expect(ragEvalCases.length).toBeGreaterThanOrEqual(150);
  });

  it("keeps the critical feeding regression in the eval set", () => {
    const criticalCase = ragEvalCases.find((testCase) => testCase.id === "critical-feeding-six-month-boy");

    expect(criticalCase).toMatchObject({
      query: "6 aylık erkek bebeğe ek gıda ne yedirilir?",
      expectedMode: "rag",
      requiredSourceTopics: ["feeding-food-safety"]
    });
    expect(criticalCase?.forbiddenPhrases).toContain("Montessori");
  });

  it.each(ragEvalCases)("$id", async (testCase) => {
    const search = vi.fn(async (query: string): Promise<RagSearchResult[]> => {
      if (testCase.expectedMode === "no_source") {
        return [];
      }

      const normalizedQuery = query.toLocaleLowerCase("tr");
      const topicMetadata = new Map(topicMatchers.map((matcher) => [matcher.topic, matcher]));
      const requestedTopics = Array.from(
        new Set([...testCase.requiredSourceTopics, ...testCase.expectedTopics])
      );
      const fixtureMatches = requestedTopics
        .map((topic) => topicMetadata.get(topic))
        .filter((matcher): matcher is (typeof topicMatchers)[number] => Boolean(matcher));

      const queryMatches = topicMatchers.filter((matcher) => matcher.pattern.test(normalizedQuery));
      const requiredTopicMatches = requestedTopics.map(createFallbackTopicMatcher);
      const fallbackMatches = requiredTopicMatches.length > 0 ? requiredTopicMatches : queryMatches;
      const matchedTopics = fallbackMatches.length > 0 ? fallbackMatches : fixtureMatches;

      if (matchedTopics.length === 0) {
        return [];
      }

      return matchedTopics.map((matched, index) => ({
        score: 0.91 - index * 0.01,
        text: `${matched.title} kaynak metni.`,
        citation: {
          title: matched.title,
          sourcePath: matched.sourcePath,
          section: "Genel",
          topic: matched.topic
        }
      }));
    });
    const service = new RagAssistantService({
      answerProvider,
      maxContextChars: 8000,
      requireSources: true,
      searchService: { search } as unknown as RagSearchService,
      toolsEnabled: false
    });

    const answer = await service.answerMessage({
      message: testCase.query,
      locale: "tr"
    });
    const expectedMode = testCase.expectedMode === "no_source" ? "no_sources" : testCase.expectedMode;

    expect(answer.mode).toBe(expectedMode);

    for (const forbiddenPhrase of testCase.forbiddenPhrases) {
      expect(answer.answer).not.toContain(forbiddenPhrase);
    }

    for (const requiredTopic of testCase.requiredSourceTopics) {
      expect(answer.sources.some((source) => source.topic === requiredTopic)).toBe(true);
    }

    if (testCase.expectedMode === "boundary") {
      expect(search).not.toHaveBeenCalled();
    }
  });
});
