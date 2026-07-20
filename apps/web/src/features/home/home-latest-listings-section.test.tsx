import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { HomeLatestListingsSection } from "./home-latest-listings-section";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock("../../lib/auth-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/auth-client")>();

  return {
    ...actual,
    getOrRefreshAuthToken: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("../favorites/api", () => ({
  fetchFavorites: vi.fn(),
  saveFavorite: vi.fn()
}));

const listing = {
  id: "listing-1",
  title: "Temiz bebek arabası",
  price: {
    amount: "3200.00",
    currency: "TRY"
  },
  favoriteCount: 0,
  status: "active",
  listingType: "sale",
  condition: "good",
  category: {
    id: "category-1",
    name: "Bebek Arabaları",
    slug: "strollers"
  },
  firstImage: {
    id: "image-1",
    url: "/api/v1/uploads/listings/image.jpg",
    sortOrder: 0
  },
  images: [],
  createdAt: "2026-06-20T10:00:00.000Z"
};

function renderSection() {
  return render(
    <I18nProvider>
      <HomeLatestListingsSection apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

describe("HomeLatestListingsSection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders loading and then listing cards with normalized local image URLs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { listings: [listing] } }), { status: 200 })
    );

    renderSection();

    expect(screen.getByText("Son ilanlar yükleniyor...")).toBeInTheDocument();
    expect(await screen.findByText("Temiz bebek arabası")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Temiz bebek arabası" })).toHaveAttribute(
      "src",
      "http://api.test/api/v1/uploads/listings/image.jpg"
    );
  });

  it("renders empty, error, and unsafe image fallback states without crashing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { listings: [] } }), { status: 200 })
    );
    const { rerender } = renderSection();

    expect(await screen.findByText("Henüz ilan yok. İlk ilanı sen oluştur.")).toBeInTheDocument();

    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    rerender(
      <I18nProvider>
        <HomeLatestListingsSection apiBaseUrl="http://api.test?retry=1" />
      </I18nProvider>
    );
    expect(await screen.findByText("Son ilanlar şu anda yüklenemedi.")).toBeInTheDocument();

    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            listings: [
              {
                ...listing,
                id: "listing-unsafe",
                firstImage: {
                  id: "image-unsafe",
                  url: "javascript:alert(1)",
                  sortOrder: 0
                }
              }
            ]
          }
        }),
        { status: 200 }
      )
    );
    rerender(
      <I18nProvider>
        <HomeLatestListingsSection apiBaseUrl="http://api.test?retry=2" />
      </I18nProvider>
    );

    expect(await screen.findByText("BabyLoop")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Temiz bebek arabası" })).not.toBeInTheDocument();
  });

  it("aborts a stale listing request when the marketplace city changes", async () => {
    let firstRequestSignal: AbortSignal | null = null;
    let requestCount = 0;

    vi.mocked(fetch).mockImplementation((_input, init) => {
      requestCount += 1;

      if (requestCount === 1) {
        firstRequestSignal = init?.signal ?? null;
        return new Promise<Response>(() => undefined);
      }

      return Promise.resolve(
        new Response(JSON.stringify({
          ok: true,
          data: {
            listings: [{ ...listing, id: "listing-istanbul" }]
          }
        }), { status: 200 })
      );
    });

    renderSection();

    await vi.waitFor(() => {
      expect(firstRequestSignal).not.toBeNull();
    });

    window.dispatchEvent(new CustomEvent("babyloop-marketplace-location-change", {
      detail: { city: "istanbul" }
    }));

    await vi.waitFor(() => {
      expect(firstRequestSignal?.aborted).toBe(true);
      expect(requestCount).toBe(2);
    });

    expect(await screen.findByText("Temiz bebek arabası")).toBeInTheDocument();
  });
});
