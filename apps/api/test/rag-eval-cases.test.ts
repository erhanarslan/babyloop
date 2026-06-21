import { describe, expect, it, vi } from "vitest";
import type { RagGroundedAnswerProvider } from "@babyloop/ai-core";
import { ragEvalCases } from "./fixtures/rag-eval-cases.js";
import { RagAssistantService } from "../src/services/rag-assistant.service.js";
import type { RagSearchService } from "../src/services/rag-search.service.js";
import type { RagSearchResult } from "../src/services/rag.types.js";

const topicMatchers: Array<{ pattern: RegExp; topic: string; title: string; sourcePath: string }> = [
  { pattern: /bebek arabas[ıi]/iu, topic: "stroller-safety", title: "Bebek arabası ikinci el kontrol listesi", sourcePath: "docs/rag/07-stroller-buying-checklist.md" },
  { pattern: /oto koltu|çarpışma/iu, topic: "car-seat-safety", title: "Oto koltuğu ikinci el kontrol listesi", sourcePath: "docs/rag/08-car-seat-second-hand-checklist.md" },
  { pattern: /oyuncak|küçük parça/iu, topic: "toy-safety", title: "Oyuncak güvenliği kontrol listesi", sourcePath: "docs/rag/09-toy-safety-checklist.md" },
  { pattern: /ana kuca|ana kucagi/iu, topic: "product-buying", title: "Ürün seçimi kontrol rehberleri", sourcePath: "docs/rag/04-product-buying-guides.md" },
  { pattern: /ilan açıklaması/iu, topic: "listing-writing", title: "İlan hazırlama rehberi", sourcePath: "docs/rag/03-listing-writing-guide.md" },
  { pattern: /[iı]ban|alışveriş/iu, topic: "safe-shopping", title: "Güvenli alışveriş rehberi", sourcePath: "docs/rag/02-safe-shopping-guide.md" },
  { pattern: /kış|mevsim|soğuk/iu, topic: "seasonal-needs", title: "Mevsimsel ihtiyaçlar rehberi", sourcePath: "docs/rag/20-seasonal-needs-guide.md" },
  { pattern: /18 aylık|yaş|ürünler|ne almalı/iu, topic: "age-based-needs", title: "Yaş dönemine göre genel ürün ihtiyaçları", sourcePath: "docs/rag/05-age-based-product-needs.md" },
  { pattern: /yanlış ürün|anlaşmazlık|rapor/iu, topic: "dispute-reporting", title: "Anlaşmazlık ve raporlama rehberi", sourcePath: "docs/rag/19-marketplace-dispute-and-reporting-guide.md" },
  { pattern: /kayıtlı arama|favoriler|BabyLoop nasıl/iu, topic: "marketplace-usage", title: "BabyLoop pazar yeri kullanım rehberi", sourcePath: "docs/rag/01-babyloop-marketplace-guide.md" },
  { pattern: /mesajlaşma/iu, topic: "messaging-privacy", title: "Mesajlaşma ve gizlilik rehberi", sourcePath: "docs/rag/06-messaging-and-privacy.md" },
  { pattern: /geri çağırma/iu, topic: "product-recall", title: "Geri çağırma ve ürün uyarısı kontrol rehberi", sourcePath: "docs/rag/12-recall-and-product-warning-guide.md" },
  { pattern: /beşik|uyku/iu, topic: "sleep-product-safety", title: "Beşik ve uyku ürünü sınırları", sourcePath: "docs/rag/11-crib-and-sleep-product-boundaries.md" },
  { pattern: /fotoğraf/iu, topic: "listing-photos", title: "Satıcı fotoğraf kalitesi rehberi", sourcePath: "docs/rag/13-seller-photo-quality-guide.md" },
  { pattern: /hangi sorular|soruları/iu, topic: "buyer-questions", title: "Alıcı soru şablonları", sourcePath: "docs/rag/14-buyer-question-templates.md" }
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

describe("rag eval cases", () => {
  it("covers at least 30 assistant quality cases", () => {
    expect(ragEvalCases.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ragEvalCases)("$id", async (testCase) => {
    const search = vi.fn(async (query: string): Promise<RagSearchResult[]> => {
      if (testCase.expectedMode === "no_source") {
        return [];
      }

      const normalizedQuery = query.toLocaleLowerCase("tr");
      const matched = topicMatchers.find((matcher) => matcher.pattern.test(normalizedQuery));

      if (!matched) {
        return [];
      }

      return [
        {
          score: 0.91,
          text: `${matched.title} kaynak metni.`,
          citation: {
            title: matched.title,
            sourcePath: matched.sourcePath,
            section: "Genel",
            topic: matched.topic
          }
        }
      ];
    });
    const service = new RagAssistantService({
      answerProvider,
      maxContextChars: 8000,
      requireSources: true,
      searchService: { search } as unknown as RagSearchService
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
