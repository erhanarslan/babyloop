import { describe, expect, it, vi } from "vitest";
import type { RagGroundedAnswerProvider } from "@babyloop/ai-core";
import { RagAssistantService } from "../src/services/rag-assistant.service.js";
import type { RagSearchService } from "../src/services/rag-search.service.js";

function createAnswerProvider(): RagGroundedAnswerProvider {
  return {
    providerName: "mock-rag-answer",
    async answerWithSources() {
      return {
        answer: "Bebek arabasında fren, tekerlek ve kumaş durumunu kontrol et.",
        providerName: "mock-rag-answer",
        promptVersion: "test"
      };
    }
  };
}

describe("rag assistant service", () => {
  it("returns boundary answer without calling Gemini for unsafe medical questions", async () => {
    const answerProvider = createAnswerProvider();
    const answerSpy = vi.spyOn(answerProvider, "answerWithSources");
    const searchService = {
      search: vi.fn()
    } as unknown as RagSearchService;
    const service = new RagAssistantService({
      answerProvider,
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage({
      message: "çocuğuma hangi ilacı vereyim",
      locale: "tr"
    });

    expect(answer.mode).toBe("boundary");
    expect(answer.answer).toContain("ilaç");
    expect(answerSpy).not.toHaveBeenCalled();
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it("returns no-source answer when retrieval has no matches", async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue([])
    } as unknown as RagSearchService;
    const service = new RagAssistantService({
      answerProvider: createAnswerProvider(),
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage({
      message: "bilgi tabanında olmayan konu",
      locale: "tr"
    });

    expect(answer.mode).toBe("no_sources");
    expect(answer.grounded).toBe(false);
    expect(answer.sources).toEqual([]);
  });

  it("uses read-only listing tools for listing search intent", async () => {
    const answerProvider = createAnswerProvider();
    const answerSpy = vi.spyOn(answerProvider, "answerWithSources");
    const searchService = {
      search: vi.fn().mockResolvedValue([])
    } as unknown as RagSearchService;
    const listingSearch = vi.fn(async () => [
      {
        listingId: "listing-1",
        title: "Temiz bebek arabası",
        href: "/listings/listing-1",
        city: "İstanbul"
      }
    ]);
    const service = new RagAssistantService({
      answerProvider,
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage(
      {
        message: "İstanbul'da bebek arabası var mı?",
        locale: "tr"
      },
      { listingSearch }
    );

    expect(answer.mode).toBe("no_sources");
    expect(answer.toolsUsed).toContain("listing_search");
    expect(answer.answer).toContain("Temiz bebek arabası");
    expect(answer.suggestedActions?.map((action) => action.type)).toContain("open_listing");
    expect(answerSpy).not.toHaveBeenCalled();
  });

  it("does not call tools for boundary questions", async () => {
    const searchService = {
      search: vi.fn()
    } as unknown as RagSearchService;
    const listingSearch = vi.fn();
    const service = new RagAssistantService({
      answerProvider: createAnswerProvider(),
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage(
      {
        message: "çocuğuma hangi ilacı vereyim",
        locale: "tr"
      },
      { listingSearch }
    );

    expect(answer.mode).toBe("boundary");
    expect(listingSearch).not.toHaveBeenCalled();
  });

  it("returns grounded answer and sources for safe sourced questions", async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue([
        {
          score: 0.91,
          text: "Bebek arabasında fren ve tekerlek kontrol edilir.",
          citation: {
            title: "Ürün seçimi kontrol rehberleri",
            sourcePath: "docs/rag/04-product-buying-guides.md",
            section: "Bebek arabası",
            topic: "product-buying"
          }
        }
      ])
    } as unknown as RagSearchService;
    const service = new RagAssistantService({
      answerProvider: createAnswerProvider(),
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage({
      message: "bebek arabası alırken nelere bakayım",
      locale: "tr"
    });

    expect(answer.mode).toBe("rag");
    expect(answer.grounded).toBe(true);
    expect(answer.sources).toHaveLength(1);
    expect(answer.answer).toContain("Bebek arabasında");
  });
  it("does not read or write cache for tool-handled answers", async () => {
    const cacheService = {
      buildKey: vi.fn(() => "assistant-cache-key"),
      get: vi.fn(),
      set: vi.fn()
    };
    const searchService = {
      search: vi.fn().mockResolvedValue([])
    } as unknown as RagSearchService;
    const listingSearch = vi.fn(async () => [
      {
        listingId: "listing-1",
        title: "Temiz bebek arabası",
        href: "/listings/listing-1",
        city: "İstanbul"
      }
    ]);

    const service = new RagAssistantService({
      answerProvider: createAnswerProvider(),
      cacheService: cacheService as never,
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage(
      {
        message: "İstanbul'da bebek arabası var mı?",
        locale: "tr"
      },
      { listingSearch }
    );

    expect(answer.toolsUsed).toContain("listing_search");
    expect(cacheService.buildKey).not.toHaveBeenCalled();
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it("keeps cache behavior for pure RAG answers", async () => {
    const cacheService = {
      buildKey: vi.fn(() => "assistant-cache-key"),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn()
    };
    const searchService = {
      search: vi.fn().mockResolvedValue([
        {
          score: 0.91,
          text: "Bebek arabasında fren ve tekerlek kontrol edilir.",
          citation: {
            title: "Bebek arabası ikinci el kontrol listesi",
            sourcePath: "docs/rag/07-stroller-buying-checklist.md",
            section: "Genel",
            topic: "stroller-safety"
          }
        }
      ])
    } as unknown as RagSearchService;

    const service = new RagAssistantService({
      answerProvider: createAnswerProvider(),
      cacheService: cacheService as never,
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage({
      message: "bebek arabası alırken nelere bakmalıyım",
      locale: "tr"
    });

    expect(answer.mode).toBe("rag");
    expect(cacheService.buildKey).toHaveBeenCalledOnce();
    expect(cacheService.get).toHaveBeenCalledOnce();
    expect(cacheService.set).toHaveBeenCalledOnce();
  });


  it("uses child personalization context for child needs intent", async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue([
        {
          score: 0.91,
          text: "Yaş dönemine göre ürün ihtiyaçları kaynak metni.",
          citation: {
            title: "Yaş dönemine göre genel ürün ihtiyaçları",
            sourcePath: "docs/rag/05-age-based-product-needs.md",
            section: "Genel",
            topic: "age-based-needs"
          }
        }
      ])
    } as unknown as RagSearchService;
    const service = new RagAssistantService({
      answerProvider: createAnswerProvider(),
      maxContextChars: 8000,
      requireSources: true,
      searchService
    });

    const answer = await service.answerMessage(
      {
        message: "Çocuğum için kışlık ürünleri takip etmek istiyorum",
        locale: "tr"
      },
      {
        childPersonalization: {
          activeChild: {
            label: "Kızım",
            ageBand: "toddler_12_24",
            ageBandLabel: "12-24 ay",
            ageMonths: 18,
            notificationCadence: "monthly"
          },
          children: [],
          season: "winter",
          seasonLabel: "Kış",
          recommendations: []
        }
      }
    );

    expect(answer.intent).toBe("child_needs");
    expect(answer.toolsUsed).toContain("child_needs_recommendations");
    expect(answer.suggestedActions?.map((action) => action.type)).toContain("review_child_recommendations");
    expect(answer.answer).toContain("Kızım");
    expect(answer.answer).toContain("Kullanıcı onayı olmadan");
  });

});
