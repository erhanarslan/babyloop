import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { LatestListingRotator } from "./latest-listing-rotator";

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

const baseListing = {
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
  locationCity: "İstanbul",
  createdAt: "2026-06-20T10:00:00.000Z"
};

function renderRotator() {
  return render(
    <I18nProvider>
      <LatestListingRotator apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

function mockMotionPreference(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
}

describe("LatestListingRotator", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockMotionPreference(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders loading and then public listing data from the API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { listings: [baseListing] } }), {
        status: 200
      })
    );

    renderRotator();

    expect(screen.getByText("Son ilanlar yükleniyor")).toBeInTheDocument();
    expect((await screen.findAllByText("Temiz bebek arabası")).length).toBeGreaterThan(0);
    expect(screen.getByText("İstanbul")).toBeInTheDocument();
    expect(screen.queryByText("seller-profile-id")).not.toBeInTheDocument();
    expect(screen.queryByText("ayse@example.test")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("renders controlled empty and error states", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { listings: [] } }), { status: 200 })
    );

    const { rerender } = renderRotator();

    expect(await screen.findByText("Henüz yeni ilan yok")).toBeInTheDocument();

    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    rerender(
      <I18nProvider>
        <LatestListingRotator apiBaseUrl="http://api.test?retry=1" />
      </I18nProvider>
    );

    expect(await screen.findByText("Son ilanlar şu an yüklenemiyor")).toBeInTheDocument();
  });

  it("does not start rotation interval when reduced motion is preferred", async () => {
    mockMotionPreference(true);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            listings: [
              baseListing,
              {
                ...baseListing,
                id: "listing-2",
                title: "Az kullanılmış oto koltuğu"
              }
            ]
          }
        }),
        { status: 200 }
      )
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 500 })
    );

    renderRotator();

    expect((await screen.findAllByText("Temiz bebek arabası")).length).toBeGreaterThan(0);
    expect(setIntervalSpy.mock.calls.some(([, delay]) => delay === 2500)).toBe(false);
  });
});
