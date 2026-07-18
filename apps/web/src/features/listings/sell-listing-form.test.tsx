import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/listings/sell-listing-form.tsx"), "utf8");

describe("SellListingForm AI draft flow", () => {
  it("uses the web AI listing draft model before applying suggestions", () => {
    expect(source).toContain("normalizeWebAiListingDraftSuggestion");
    expect(source).toContain("buildWebAiListingDraftApplyPatch");
    expect(source).toContain("Boş alanlara uygula");
  });

  it("marks drafts stale when meaningful form state changes", () => {
    expect(source).toContain("markDraftSuggestionStaleIfFormChanged");
    expect(source).toContain("onChange={markDraftSuggestionStaleIfFormChanged}");
    expect(source).toContain("shouldMarkWebAiListingDraftStale");
  });

  it("does not auto-submit listings from AI suggestion generation", () => {
    const generateDraftBlock = source.slice(source.indexOf("async function handleGenerateDraftSuggestion"));

    expect(generateDraftBlock).toContain("requestListingDraftSuggestion");
    expect(generateDraftBlock).not.toContain("createListing(");
    expect(generateDraftBlock).not.toContain("handleSubmit(");
  });
  it("requires explicit donation confirmation for price-free listings", () => {
    expect(source).toContain("needsDonationConfirmation");
    expect(source).toContain("toDonationListingPayload");
    expect(source).toContain("Onayla ve bağış ilanı oluştur");
    expect(source).toContain("Fiyat bilgisi girmediğin için bu ilan bağış ilanı olarak oluşturulacak");
  });

});
