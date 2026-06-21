import { describe, expect, it } from "vitest";
import { AssistantToolRegistry } from "../src/services/assistant-tool-registry.service.js";

describe("assistant tool registry", () => {
  it("registers read-only foundation tools", () => {
    const registry = new AssistantToolRegistry();
    const tools = registry.list();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "category_lookup",
      "child_age_band_explain",
      "listing_search",
      "rag_search"
    ]);
    expect(tools.every((tool) => tool.readOnly)).toBe(true);
  });

  it("executes category lookup with safe BabyLoop category links", async () => {
    const registry = new AssistantToolRegistry();
    const result = await registry.execute("category_lookup", {}, { query: "oto koltuğu" });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : []).toEqual([
      {
        label: "Oto koltuğu",
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
          return [
            {
              id: "listing-1",
              title: "Temiz bebek arabası",
              href: "/listings/listing-1",
              price: "3200 TRY",
              category: "Bebek Arabaları",
              condition: "good",
              city: "İstanbul",
              imageUrl: "/uploads/listing.jpg"
            }
          ];
        }
      },
      { query: "bebek arabası" }
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : undefined).toMatchObject({
      available: true,
      results: [
        {
          id: "listing-1",
          title: "Temiz bebek arabası",
          href: "/listings/listing-1"
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("email");
    expect(JSON.stringify(result)).not.toContain("phone");
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
