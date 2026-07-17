import type { MobileAssistantAnswer } from "./assistant-api";
import {
  buildMobileAssistantAnswerDisplay,
  getAssistantModeLabel
} from "./assistant-display-model";

const baseAnswer: MobileAssistantAnswer = {
  answer: "Kontrol listesiyle ilerle.",
  grounded: true,
  mode: "rag",
  sources: [],
  suggestedActions: [],
  toolResultsPreview: [],
  toolsUsed: []
};

describe("mobile assistant display model", () => {
  it("maps assistant modes to Turkish labels", () => {
    expect(getAssistantModeLabel("rag")).toBe("Kaynaklı yanıt");
    expect(getAssistantModeLabel("boundary")).toBe("Güvenlik sınırı");
    expect(getAssistantModeLabel("no_sources")).toBe("Yeterli kaynak bulunamadı");
  });

  it("deduplicates source cards and never uses raw sourcePath as display label", () => {
    const display = buildMobileAssistantAnswerDisplay({
      ...baseAnswer,
      sources: [
        {
          title: "Alışveriş kontrol listesi",
          section: "Bebek arabası",
          sourcePath: "docs/rag/internal-marketplace.md"
        },
        {
          title: "Alışveriş kontrol listesi",
          section: "Bebek arabası",
          sourcePath: "docs/rag/internal-marketplace.md"
        }
      ]
    });

    expect(display.sourceCards).toEqual([
      {
        id: "alışveriş kontrol listesi:bebek arabası",
        label: "Alışveriş kontrol listesi · Bebek arabası"
      }
    ]);
    expect(JSON.stringify(display)).not.toContain("docs/rag/internal-marketplace.md");
  });

  it("does not show source cards for boundary and no-source answers", () => {
    expect(buildMobileAssistantAnswerDisplay({
      ...baseAnswer,
      mode: "boundary",
      sources: [{ title: "Kaynak", sourcePath: "docs/rag/source.md" }]
    }).sourceCards).toEqual([]);
    expect(buildMobileAssistantAnswerDisplay({
      ...baseAnswer,
      mode: "no_sources",
      sources: [{ title: "Kaynak", sourcePath: "docs/rag/source.md" }]
    }).sourceCards).toEqual([]);
  });

  it("keeps only safe internal action hrefs", () => {
    const display = buildMobileAssistantAnswerDisplay({
      ...baseAnswer,
      suggestedActions: [
        {
          type: "open_listing",
          label: "İlana git",
          href: "/listing/listing-1"
        },
        {
          type: "open_search",
          label: "Dış link",
          href: "javascript:alert(1)"
        },
        {
          type: "copy_questions",
          label: "Satıcıya sor"
        }
      ]
    });

    expect(display.actionCards).toEqual([
      {
        id: "open_listing-0",
        label: "İlana git",
        type: "open_listing",
        href: "/listing/listing-1"
      },
      {
        id: "copy_questions-1",
        label: "Satıcıya sor",
        type: "copy_questions"
      }
    ]);
  });
});
