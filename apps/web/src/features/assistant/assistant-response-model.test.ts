import { describe, expect, it } from "vitest";
import {
  isSafeWebAssistantHref,
  normalizeWebAssistantResponse
} from "./assistant-response-model";

describe("web assistant response model", () => {
  it("normalizes grounded responses with deduped safe sources and actions", () => {
    const response = normalizeWebAssistantResponse({
      answer: "Bebek arabasında fren ve katlanma mekanizmasını kontrol et.",
      grounded: true,
      mode: "rag",
      providerName: "provider",
      promptVersion: "v1",
      sources: [
        {
          title: "İkinci el kontrol listesi",
          section: "Bebek arabası",
          sourcePath: "docs/rag/44-internal.md",
          sourceReliability: "reviewed",
          topic: "stroller"
        },
        {
          title: "İkinci el kontrol listesi",
          section: "Bebek arabası",
          sourcePath: "docs/rag/44-internal.md"
        }
      ],
      suggestedActions: [
        { href: "/browse?query=bebek%20arabası", label: "İlanlara bak", type: "open_search" },
        { href: "https://evil.test", label: "Dış link", type: "open_search" }
      ],
      toolResultsPreview: [
        { summary: "3 güvenli sonuç", title: "Listeleme", tool: "listing_search" }
      ]
    });

    expect(response).toMatchObject({
      grounded: true,
      mode: "rag",
      modeLabel: "Kaynaklı yanıt",
      showGrounded: true
    });
    expect(response.sourceCards).toHaveLength(1);
    expect(response.sourceCards[0]?.label).toBe("İkinci el kontrol listesi · Bebek arabası");
    expect(response.actionCards).toHaveLength(1);
    expect(response.actionCards[0]?.href).toBe("/browse?query=bebek%20arabası");
    expect(JSON.stringify(response)).not.toMatch(/sourcePath|docs\/rag|providerName|promptVersion|sk-|Bearer/iu);
  });

  it("keeps boundary and no-source answers out of grounded/source display", () => {
    expect(normalizeWebAssistantResponse({
      answer: "Bu konuda ilaç veya tedavi önerisi veremem.",
      grounded: true,
      mode: "boundary",
      sources: [{ title: "Kaynak", sourcePath: "docs/rag/internal.md" }]
    })).toMatchObject({
      mode: "boundary",
      modeLabel: "Güvenlik sınırı",
      showGrounded: false,
      sourceCards: []
    });

    expect(normalizeWebAssistantResponse({
      answer: "Yeterli kaynak bulunamadı.",
      mode: "no_sources"
    })).toMatchObject({
      mode: "no_sources",
      modeLabel: "Yeterli kaynak bulunamadı",
      sourceCards: []
    });
  });

  it.each<[string, boolean]>([
    ["/browse?query=oyuncak", true],
    ["/listings/listing-1", true],
    ["/sell", true],
    ["/account/children", true],
    ["/admin", false],
    ["//evil.test", false],
    ["https://evil.test", false],
    ["http://evil.test", false],
    ["javascript:alert(1)", false],
    ["data:text/html,hello", false],
    ["/browse\nSet-Cookie:x", false],
    ["/browse\\evil", false]
  ])("validates assistant suggested href %s", (href, expected) => {
    expect(isSafeWebAssistantHref(href)).toBe(expected);
  });

  it("rejects malformed responses", () => {
    expect(() => normalizeWebAssistantResponse({ mode: "rag" })).toThrow("Asistan yanıtı okunamadı.");
  });
});
