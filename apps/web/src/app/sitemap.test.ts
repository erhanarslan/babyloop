import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "../lib/api";
import sitemap from "./sitemap";

vi.mock("../features/parent-guides/parent-guide-data", () => ({
  parentGuideTopics: [{ id: "stroller-buying-checklist" }, { id: "car-seat-safety-checks" }]
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();

  return {
    ...actual,
    fetchApi: vi.fn()
  };
});

const originalNextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalBabyloopSiteUrl = process.env.BABYLOOP_SITE_URL;

describe("web sitemap route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://babyloop.test/";
    delete process.env.BABYLOOP_SITE_URL;

    vi.mocked(fetchApi).mockImplementation(async (path: string) => {
      if (path === "/api/v1/categories") {
        return {
          ok: true,
          data: {
            categories: [
              { id: "category-strollers", name: "Bebek Arabaları", slug: "strollers" },
              { id: "category-car-seats", name: "Oto Koltukları", slug: "car-seats" }
            ]
          }
        } as any;
      }

      if (path === "/api/v1/listings?limit=50&sort=newest&hasImages=true") {
        return {
          ok: true,
          data: {
            listings: [
              {
                id: "listing-active",
                status: "active",
                createdAt: "2026-01-02T00:00:00.000Z"
              },
              {
                id: "listing-reserved",
                status: "reserved",
                createdAt: "2026-01-03T00:00:00.000Z"
              },
              {
                id: "listing-sold",
                status: "sold",
                createdAt: "2026-01-04T00:00:00.000Z"
              }
            ]
          }
        } as any;
      }

      return {
        ok: false,
        error: {
          code: "UNHANDLED_TEST_PATH",
          message: path
        }
      } as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();

    if (originalNextPublicSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalNextPublicSiteUrl;
    }

    if (originalBabyloopSiteUrl === undefined) {
      delete process.env.BABYLOOP_SITE_URL;
    } else {
      process.env.BABYLOOP_SITE_URL = originalBabyloopSiteUrl;
    }
  });

  it("includes canonical public routes, categories, guides, and indexable listings", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(fetchApi).toHaveBeenCalledWith("/api/v1/categories");
    expect(fetchApi).toHaveBeenCalledWith("/api/v1/listings?limit=50&sort=newest&hasImages=true");

    expect(urls).toEqual(expect.arrayContaining([
      "https://babyloop.test/",
      "https://babyloop.test/browse",
      "https://babyloop.test/guides",
      "https://babyloop.test/assistant",
      "https://babyloop.test/categories/strollers",
      "https://babyloop.test/categories/car-seats",
      "https://babyloop.test/guides/stroller-buying-checklist",
      "https://babyloop.test/guides/car-seat-safety-checks",
      "https://babyloop.test/listings/listing-active",
      "https://babyloop.test/listings/listing-reserved"
    ]));

    expect(urls).not.toContain("https://babyloop.test/listings/listing-sold");
    expect(entries.find((entry) => entry.url === "https://babyloop.test/")?.priority).toBe(1);
    expect(entries.find((entry) => entry.url === "https://babyloop.test/browse")?.changeFrequency).toBe("hourly");
  });
});
