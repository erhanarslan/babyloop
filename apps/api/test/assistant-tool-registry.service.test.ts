import { describe, expect, it } from "vitest";
import { AssistantToolRegistry } from "../src/services/assistant-tool-registry.service.js";

describe("assistant tool registry", () => {
  it("registers safe read-only and draft-only assistant tools", () => {
    const registry = new AssistantToolRegistry();
    const tools = registry.list();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "buyer_question_templates",
      "category_lookup",
      "child_age_band_explain",
      "listing_detail",
      "listing_draft_helper",
      "listing_search",
      "rag_search",
      "saved_search_suggest_draft",
      "seller_public_summary"
    ]);
    expect(tools.every((tool) => tool.readOnly || tool.draftOnly)).toBe(true);
    expect(tools.every((tool) => tool.returnsPrivateData === false)).toBe(true);
  });

  it("executes category lookup with safe BabyLoop category links", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute("category_lookup", {}, { query: "oto koltuğu" });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : []).toEqual([
      {
        categoryId: "oto-koltugu",
        label: "Oto koltuğu",
        aliases: ["oto koltuğu", "araba koltuğu"],
        relatedCategories: ["Bebek arabası", "Beslenme", "Oyuncak"],
        href: "/browse?q=oto%20koltu%C4%9Fu"
      }
    ]);
  });

  it("returns listing search fallback when no read-only service is connected", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute("listing_search", {}, { query: "bebek arabası", city: "İstanbul" });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : undefined).toMatchObject({
      available: false,
      results: [],
      fallbackHref: "/browse?q=bebek+arabas%C4%B1&city=%C4%B0stanbul"
    });
  });

  it("executes connected listing search and returns safe summary DTOs", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute(
      "listing_search",
      {
        async listingSearch() {
          const unsafeServiceRow = {
            listingId: "listing-1",
            title: "Temiz bebek arabası",
            href: "/listings/listing-1",
            price: "3200 TRY",
            category: "Bebek Arabaları",
            condition: "good",
            city: "İstanbul",
            imageUrl: "/uploads/listing.jpg",
            email: "seller@example.com",
            phone: "+905551112233"
          };

          return [unsafeServiceRow];
        }
      },
      { query: "bebek arabası" }
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : undefined).toMatchObject({
      available: true,
      results: [
        {
          listingId: "listing-1",
          title: "Temiz bebek arabası",
          href: "/listings/listing-1"
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("email");
    expect(JSON.stringify(result)).not.toContain("phone");
  });

  it("returns public-safe listing detail summaries", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute(
      "listing_detail",
      {
        async listingDetail() {
          const unsafeServiceRow = {
            listingId: "listing-1",
            title: "Temiz bebek arabası",
            href: "/listings/listing-1",
            imageCount: 2,
            descriptionPreview: "Az kullanılmış.",
            city: "İstanbul",
            safeSellerSummary: {
              displayName: "Erhan",
              city: "İstanbul"
            },
            email: "seller@example.com",
            phone: "+905551112233"
          };

          return unsafeServiceRow;
        }
      },
      { listingId: "listing-1" }
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : undefined).toMatchObject({
      available: true,
      detail: {
        listingId: "listing-1",
        title: "Temiz bebek arabası",
        safeSellerSummary: {
          displayName: "Erhan"
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain("email");
    expect(JSON.stringify(result)).not.toContain("phone");
  });

  it("generates buyer question templates without write actions", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute("buyer_question_templates", {}, { productType: "oto koltuğu" });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : undefined).toMatchObject({
      topic: "oto koltuğu"
    });
    expect(JSON.stringify(result)).toContain("kaza");
    expect(JSON.stringify(result)).not.toContain("kesin güvenlidir");
  });

  it("returns draft-only listing and saved search suggestions", async () => {
    const registry = new AssistantToolRegistry();
    const listingDraft = await registry.execute("listing_draft_helper", {}, { productType: "bebek arabası" });
    const savedSearchDraft = await registry.execute("saved_search_suggest_draft", {}, {
      query: "kışlık mont",
      city: "İstanbul",
      ageSignal: "2 yaş"
    });

    expect(listingDraft.ok ? listingDraft.data : undefined).toMatchObject({
      photoChecklist: expect.any(Array),
      safetyNotes: expect.arrayContaining(["Kesin güvenlik veya sağlık garantisi verme."])
    });
    expect(savedSearchDraft.ok ? savedSearchDraft.data : undefined).toMatchObject({
      note: "Bu sadece taslaktır; kullanıcı onayı olmadan kayıtlı arama oluşturulmaz."
    });
  });

  it("explains child age bands without writing data", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute("child_age_band_explain", {}, { ageMonths: 18 });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : undefined).toMatchObject({
      label: "12-24 ay"
    });
  });
});
