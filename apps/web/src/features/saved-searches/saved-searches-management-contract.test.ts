import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SavedSearchesPageContent,
  buildSavedSearchChips,
  buildSavedSearchHref
} from "./saved-searches-page-content";
import { listSavedSearches } from "./saved-searches-api";

let protectedRouteState = {
  isAuthenticated: false,
  isCheckingAuth: false
};

vi.mock("../../lib/use-protected-route", () => ({
  useProtectedRoute: () => ({
    ...protectedRouteState,
    requireAuth: vi.fn()
  })
}));

vi.mock("./saved-searches-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./saved-searches-api")>();

  return {
    ...actual,
    deleteSavedSearch: vi.fn(),
    listSavedSearches: vi.fn()
  };
});

const legacyRouteSource = readFileSync(
  join(process.cwd(), "src/app/saved-searches/page.tsx"),
  "utf8"
);

describe("saved searches management page", () => {
  beforeEach(() => {
    protectedRouteState = {
      isAuthenticated: false,
      isCheckingAuth: false
    };
    vi.mocked(listSavedSearches).mockReset();
  });

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

  it("does not call the saved-search API before a guest is authenticated", async () => {
    render(createElement(SavedSearchesPageContent, { apiBaseUrl: "http://api.test" }));

    await waitFor(() => {
      expect(listSavedSearches).not.toHaveBeenCalled();
    });
  });

  it("loads through the exact apiBaseUrl after authentication is verified", async () => {
    protectedRouteState = {
      isAuthenticated: true,
      isCheckingAuth: false
    };
    vi.mocked(listSavedSearches).mockResolvedValueOnce([]);

    render(createElement(SavedSearchesPageContent, { apiBaseUrl: "http://api.test" }));

    await waitFor(() => {
      expect(listSavedSearches).toHaveBeenCalledTimes(1);
      expect(listSavedSearches).toHaveBeenCalledWith("http://api.test");
    });
  });
});
