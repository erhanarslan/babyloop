jest.mock("../../config/api", () => ({
  getApiBaseUrl: () => "https://api.babyloop.test"
}));

import {
  askMobileAssistant,
  isSafeMobileAssistantHref,
  normalizeMobileAssistantAnswer
} from "./assistant-api";

describe("mobile assistant api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  it("parses grounded RAG responses with safe sources and actions", () => {
    const answer = normalizeMobileAssistantAnswer({
      answer: "Bebek arabasında fren, katlanma ve kumaş durumunu kontrol et.",
      grounded: true,
      mode: "rag",
      sources: [
        {
          title: "İkinci el kontrol listesi",
          section: "Bebek arabası",
          sourcePath: "docs/rag/marketplace.md",
          sourceReliability: "official"
        }
      ],
      suggestedActions: [
        {
          type: "open_search",
          label: "Bebek arabalarını gör",
          href: "/browse?query=bebek%20arabası"
        },
        {
          type: "open_search",
          label: "Dış link",
          href: "https://example.test"
        }
      ],
      toolResultsPreview: [
        {
          tool: "listing_search",
          title: "3 ilan bulundu",
          summary: "Yakın zamanda eklenen ilanlar"
        }
      ],
      toolsUsed: ["listing_search"]
    });

    expect(answer.mode).toBe("rag");
    expect(answer.grounded).toBe(true);
    expect(answer.sources[0]).toMatchObject({
      title: "İkinci el kontrol listesi",
      section: "Bebek arabası",
      sourceReliability: "official"
    });
    expect(answer.suggestedActions).toHaveLength(1);
    expect(answer.suggestedActions[0]?.href).toBe("/browse?query=bebek%20arabası");
    expect(JSON.stringify(answer)).not.toMatch(/sk-|Bearer|raw-provider|promptSecret/iu);
  });

  it("parses boundary and no-source modes without trusting unknown fields", () => {
    expect(normalizeMobileAssistantAnswer({
      answer: "Bu konuda sağlık veya ilaç önerisi veremem.",
      mode: "boundary",
      grounded: false,
      sources: [{ title: "Gizli", sourcePath: "docs/rag/internal.md" }]
    })).toMatchObject({
      mode: "boundary",
      grounded: false
    });

    expect(normalizeMobileAssistantAnswer({
      answer: "Yeterli kaynak bulamadım.",
      mode: "unexpected",
      grounded: "yes"
    })).toMatchObject({
      mode: "no_sources",
      grounded: false,
      sources: []
    });
  });

  it("rejects malformed assistant responses", () => {
    expect(() => normalizeMobileAssistantAnswer({ mode: "rag" })).toThrow("Asistan yanıtı okunamadı.");
  });

  it.each([
    ["/listing/listing-1", true],
    ["/browse?query=oyuncak", true],
    ["//evil.test", false],
    ["https://evil.test", false],
    ["http://evil.test", false],
    ["javascript:alert(1)", false],
    ["data:text/html,hello", false]
  ])("validates suggested action href %s", (href, expected) => {
    expect(isSafeMobileAssistantHref(href)).toBe(expected);
  });

  it("keeps rate limit and unavailable errors user-friendly", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        error: {
          code: "RAG_USAGE_LIMIT_EXCEEDED",
          message: "raw provider secret sk-test should not leak"
        }
      })
    }) as Response);

    await expect(askMobileAssistant("Bebek arabası?")).rejects.toThrow(
      "Asistan kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyebilirsin."
    );

    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        error: {
          code: "ASSISTANT_UNAVAILABLE",
          message: "provider unavailable"
        }
      })
    }) as Response);

    await expect(askMobileAssistant("Bebek arabası?")).rejects.toThrow(
      "Asistan şu an hazırlanamadı. Daha sonra tekrar deneyebilirsin."
    );
  });
});
