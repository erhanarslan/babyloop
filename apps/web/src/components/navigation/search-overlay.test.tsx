import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dictionaries } from "../../lib/i18n/dictionaries";
import { buildBrowseHref, SearchOverlay } from "./search-overlay";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  })
}));

const dictionary = dictionaries.tr;

function renderSearchOverlay() {
  return render(
    <SearchOverlay
      apiBaseUrl="http://api.test"
      dictionary={dictionary}
      isAuthenticated={false}
      selectedCity="istanbul"
    />
  );
}

describe("SearchOverlay", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the search input and does not fetch suggestions for short queries", async () => {
    renderSearchOverlay();

    const input = screen.getByRole("searchbox", {
      name: dictionary.publicShell.header.searchTitle
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ab" } });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches listing suggestions for 3+ character queries", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            listings: [
              {
                id: "listing-1",
                title: "Temiz bebek arabası",
                category: { name: "Bebek Arabaları" }
              }
            ]
          }
        }),
        { status: 200 }
      )
    );

    renderSearchOverlay();

    const input = screen.getByRole("searchbox", {
      name: dictionary.publicShell.header.searchTitle
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "puset" } });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        [
          "http://api.test/api/v1/listings",
          "hasImages=true&limit=5&offset=0&q=puset&sort=newest&city=%C4%B0stanbul"
        ].join("?"),
        expect.objectContaining({ cache: "no-store" })
      );
    });
    expect(await screen.findByText("Temiz bebek arabası")).toBeInTheDocument();
    expect(screen.getByText("Bebek Arabaları")).toBeInTheDocument();
  });

  it("submits encoded browse navigation and stores recent searches", () => {
    renderSearchOverlay();

    const input = screen.getByRole("searchbox", {
      name: dictionary.publicShell.header.searchTitle
    });
    fireEvent.change(input, { target: { value: "bebek arabası <script>" } });
    fireEvent.submit(input.closest("form")!);

    expect(pushMock).toHaveBeenCalledWith(
      "/browse?q=bebek+arabas%C4%B1+%3Cscript%3E&city=%C4%B0stanbul"
    );
    expect(screen.queryByText("<script>")).not.toBeInTheDocument();
  });

  it("shows a controlled empty state when suggestions fail", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));

    renderSearchOverlay();

    const input = screen.getByRole("searchbox", {
      name: dictionary.publicShell.header.searchTitle
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "araba" } });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    });

    expect(await screen.findByText("Sonuç bulunamadı. Aramayı yine de yapabilirsin.")).toBeInTheDocument();
  });
});

describe("buildBrowseHref", () => {
  it("keeps browse hrefs encoded and omits default country location", () => {
    expect(buildBrowseHref("oto koltuğu", "turkiye", { condition: "good" })).toBe(
      "/browse?q=oto+koltu%C4%9Fu&condition=good"
    );
  });

  it("uses the API-facing Turkish city label instead of the storage slug", () => {
    expect(buildBrowseHref("puset", "istanbul")).toBe(
      "/browse?q=puset&city=%C4%B0stanbul"
    );
  });
});
