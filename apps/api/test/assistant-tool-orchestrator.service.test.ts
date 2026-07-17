import { describe, expect, it, vi } from "vitest";
import { AssistantToolOrchestrator } from "../src/services/assistant-tool-orchestrator.service.js";
import { routeRagDomain } from "../src/services/rag-domain-router.service.js";

describe("assistant tool orchestrator", () => {
  it("uses listing search and RAG tools for marketplace search questions", async () => {
    const orchestrator = new AssistantToolOrchestrator();
    const listingSearch = vi.fn(async () => [
      {
        listingId: "listing-1",
        title: "Temiz bebek arabası",
        href: "/listings/listing-1",
        price: "3200 TRY",
        category: "Bebek Arabaları",
        city: "İstanbul"
      }
    ]);
    const ragSearch = vi.fn(async () => [
      {
        score: 0.9,
        text: "Bebek arabasında fren ve tekerlek kontrol edilir.",
        citation: {
          title: "Bebek arabası rehberi",
          sourcePath: "docs/rag/07-stroller-buying-checklist.md",
          section: "Kontrol listesi",
          topic: "stroller-safety"
        }
      }
    ]);

    const result = await orchestrator.orchestrate({
      context: { listingSearch, ragSearch },
      intent: "listing_search",
      message: "İstanbul'da bebek arabası var mı?"
    });

    expect(result.handled).toBe(true);
    expect(result.answer?.toolsUsed).toEqual(["listing_search", "rag_search"]);
    expect(result.answer?.answer).toContain("Temiz bebek arabası");
    expect(result.answer?.suggestedActions?.map((action) => action.type)).toContain("open_listing");
    expect(JSON.stringify(result)).not.toContain("email");
    expect(JSON.stringify(result)).not.toContain("phone");
  });

  it("returns draft-only answer for listing help", async () => {
    const orchestrator = new AssistantToolOrchestrator();
    const result = await orchestrator.orchestrate({
      context: {},
      intent: "listing_help",
      message: "Bebek arabası için ilan açıklaması yaz"
    });

    expect(result.handled).toBe(true);
    expect(result.answer?.toolsUsed).toContain("listing_draft_helper");
    expect(result.answer?.answer).toContain("Bu yalnızca taslaktır");
    expect(result.answer?.suggestedActions?.[0]).toMatchObject({
      type: "review_listing_draft"
    });
  });

  it("summarizes listing detail with public-safe fields", async () => {
    const orchestrator = new AssistantToolOrchestrator();
    const listingDetail = vi.fn(async () => ({
      listingId: "listing-12345678",
      title: "Temiz oto koltuğu",
      href: "/listings/listing-12345678",
      imageCount: 3,
      price: "2400 TRY",
      category: "Oto Koltukları",
      condition: "good",
      city: "İstanbul"
    }));

    const result = await orchestrator.orchestrate({
      context: { listingDetail },
      intent: "listing_detail",
      message: "Bu ilan listing-12345678 iyi mi?"
    });

    expect(result.handled).toBe(true);
    expect(result.answer?.toolsUsed).toContain("listing_detail");
    expect(result.answer?.answer).toContain("Temiz oto koltuğu");
    expect(JSON.stringify(result)).not.toContain("email");
    expect(JSON.stringify(result)).not.toContain("phone");
  });

  it("does not crash the assistant response when a tool fails", async () => {
    const orchestrator = new AssistantToolOrchestrator();
    const result = await orchestrator.orchestrate({
      context: {
        async listingSearch() {
          throw new Error("database temporarily unavailable");
        }
      },
      intent: "listing_search",
      message: "scooter ilanı ara"
    });

    expect(result.handled).toBe(true);
    expect(result.answer?.answer).toContain("uygun ilan bulamadım");
    expect(result.answer?.toolsUsed).toEqual(["rag_search"]);
  });
  it("orchestrates child needs into child recommendations and saved search draft", async () => {
    const orchestrator = new AssistantToolOrchestrator();
    const ragSearch = vi.fn(async () => [
      {
        score: 0.9,
        text: "Yaş dönemine göre ürün ihtiyaçları kaynak metni.",
        citation: {
          title: "Yaş dönemine göre genel ürün ihtiyaçları",
          sourcePath: "docs/rag/05-age-based-product-needs.md",
          section: "Genel",
          topic: "age-based-needs"
        }
      }
    ]);

    const result = await orchestrator.orchestrate({
      context: {
        ragSearch,
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
      },
      intent: "child_needs",
      message: "Çocuğum için kışlık ürünleri takip etmek istiyorum"
    });

    expect(result.handled).toBe(true);
    expect(result.answer?.toolsUsed).toContain("child_needs_recommendations");
    expect(result.answer?.toolsUsed).toContain("saved_search_suggest_draft");
    expect(result.answer?.suggestedActions?.map((action) => action.type)).toContain("review_child_recommendations");
    expect(result.answer?.answer).toContain("Kızım");
  });

  it("fail-closes when a feeding domain would invoke child product tools", async () => {
    const orchestrator = new AssistantToolOrchestrator();
    const ragSearch = vi.fn();

    const result = await orchestrator.orchestrate({
      context: {
        childPersonalization: null,
        ragSearch
      },
      domainDecision: routeRagDomain("6 aylık erkek bebeğe ek gıda ne yedirilir?"),
      intent: "child_needs",
      message: "6 aylık erkek bebeğe ek gıda ne yedirilir?"
    });

    expect(result.handled).toBe(false);
    expect(ragSearch).not.toHaveBeenCalled();
  });

});
