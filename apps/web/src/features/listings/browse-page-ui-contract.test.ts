import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/features/listings/browse-page-content.tsx"),
  "utf8"
);

describe("browse page UI contract", () => {
  it("uses the full card as the listing detail link", () => {
    const card = source.slice(
      source.indexOf("function ListingCard("),
      source.indexOf("\nfunction ", source.indexOf("function ListingCard(") + 1)
    );

    expect(card).toContain("browse-listing-card-hit-area");
    expect(card).toContain('href={`/listings/${listing.id}`}');
    expect(card).not.toContain("dictionary.common.viewDetails");
  });

  it("shows donation semantics when a listing has no price", () => {
    expect(source).toContain(
      'formatListingType(listing.price ? listing.listingType : "donation", dictionary)'
    );
  });


  it("renders a compact, action-oriented no-results state", () => {
    expect(source).toContain("noResultsVisual");
    expect(source).toContain("noResultsPrimaryAction");
    expect(source).toContain("noResultsAside");
    expect(source).toContain("Aramayı sadeleştir");
    expect(source).toContain("Konumu genişlet");
  });

  it("does not expose the redundant image-only filter", () => {
    expect(source).not.toContain('name="hasImages"');
    expect(source).not.toContain('label: "Sadece görselli"');
  });
});
