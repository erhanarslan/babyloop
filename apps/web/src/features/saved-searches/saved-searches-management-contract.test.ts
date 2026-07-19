import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildSavedSearchChips,
  buildSavedSearchHref
} from "./saved-searches-page-content";

const legacyRouteSource = readFileSync(
  join(process.cwd(), "src/app/saved-searches/page.tsx"),
  "utf8"
);

describe("saved searches management page", () => {
  it("localizes sort values instead of exposing API tokens", () => {
    expect(buildSavedSearchChips({ sort: "newest" })).toContain(
      "Sıralama: En yeni"
    );
    expect(buildSavedSearchChips({ sort: "price_desc" })).toContain(
      "Sıralama: Fiyat: yüksekten düşüğe"
    );
  });

  it("builds a browse link from supported saved filters", () => {
    const href = buildSavedSearchHref({
      q: "bebek arabası",
      listingType: "donation",
      sort: "newest",
      priceMax: 2500
    });

    expect(href).toContain("/browse?");
    expect(href).toContain("q=bebek+arabas%C4%B1");
    expect(href).toContain("listingType=donation");
    expect(href).toContain("priceMax=2500");
    expect(href).not.toContain("sort=newest");
    expect(href).not.toContain("hasImages");
  });

  it("redirects the legacy route to the canonical account page", () => {
    expect(legacyRouteSource).toContain('redirect("/account/saved-searches")');
    expect(legacyRouteSource).toContain("buildNoIndexMetadata");
    expect(legacyRouteSource).not.toContain("<SavedSearchesPageContent");
  });
});
