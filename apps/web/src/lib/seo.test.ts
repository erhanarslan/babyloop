import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Category, ListingDetail } from "./api";
import {
  buildCanonicalUrl,
  buildCategoryMetadata,
  buildFilteredBrowseNoIndexMetadata,
  buildListingBreadcrumbJsonLd,
  buildListingJsonLd,
  buildListingMetadata,
  buildPublicPageMetadata,
  getSiteUrl,
  serializeStructuredData
} from "./seo";

const originalNextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalBabyloopSiteUrl = process.env.BABYLOOP_SITE_URL;
const originalNextPublicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("web SEO helpers", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://babyloop.test/";
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.babyloop.test/";
    delete process.env.BABYLOOP_SITE_URL;
  });

  afterEach(() => {
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

    if (originalNextPublicApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalNextPublicApiBaseUrl;
    }
  });

  it("normalizes site and canonical URLs", () => {
    expect(getSiteUrl()).toBe("https://babyloop.test");
    expect(buildCanonicalUrl("/browse")).toBe("https://babyloop.test/browse");
    expect(buildCanonicalUrl("listings/listing-1")).toBe("https://babyloop.test/listings/listing-1");
  });

  it("builds indexable public page metadata with canonical and social previews", () => {
    const metadata = buildPublicPageMetadata({
      title: "Browse trusted baby essentials",
      description: "Find parent-owned baby essentials with safer marketplace checks.",
      path: "/browse"
    }) as Record<string, any>;

    expect(metadata.title).toBe("Browse trusted baby essentials");
    expect(metadata.description).toContain("parent-owned baby essentials");
    expect(metadata.alternates.canonical).toBe("https://babyloop.test/browse");
    expect(metadata.openGraph.url).toBe("https://babyloop.test/browse");
    expect(metadata.openGraph.siteName).toBe("BabyLoop");
    expect(metadata.twitter.card).toBe("summary_large_image");
    expect(metadata.robots).toEqual(expect.objectContaining({ index: true, follow: true }));
  });

  it("keeps filtered browse metadata out of the index", () => {
    const metadata = buildFilteredBrowseNoIndexMetadata("Filtered stroller results") as Record<string, any>;

    expect(metadata.title).toBe("Filtered stroller results");
    expect(metadata.robots).toEqual(expect.objectContaining({ index: false, follow: false }));
  });

  it("builds category metadata from public category slugs", () => {
    const category: Category = {
      id: "category-strollers",
      name: "Bebek Arabaları",
      parentId: null,
      slug: "strollers"
    };

    const metadata = buildCategoryMetadata(category) as Record<string, any>;

    expect(metadata.title).toBe("Bebek Arabaları listings for parents");
    expect(metadata.description).toContain("Bebek Arabaları");
    expect(metadata.alternates.canonical).toBe("https://babyloop.test/categories/strollers");
    expect(metadata.robots).toEqual(expect.objectContaining({ index: true, follow: true }));
  });

  it("builds listing metadata only for public active or reserved listings", () => {
    const activeListing = createListingDetail({ status: "active" });
    const activeMetadata = buildListingMetadata(activeListing) as Record<string, any>;

    expect(activeMetadata.title).toBe("Temiz bebek arabası in Bebek Arabaları");
    expect(activeMetadata.description).toContain("Temiz bebek arabası on BabyLoop");
    expect(activeMetadata.alternates.canonical).toBe("https://babyloop.test/listings/listing-seo-1");
    expect(activeMetadata.openGraph.images[0].url).toBe(
      "https://api.babyloop.test/uploads/listings/listing-seo-1/photo.jpg"
    );
    expect(activeMetadata.robots).toEqual(expect.objectContaining({ index: true, follow: true }));

    const soldMetadata = buildListingMetadata(createListingDetail({ status: "sold" })) as Record<string, any>;
    expect(soldMetadata.robots).toEqual(expect.objectContaining({ index: false, follow: false }));
  });

  it("builds safe Product and Breadcrumb structured data for indexable listings", () => {
    const listing = createListingDetail({ status: "reserved" });
    const productJsonLd = buildListingJsonLd(listing) as Record<string, any>;
    const breadcrumbJsonLd = buildListingBreadcrumbJsonLd(listing) as Record<string, any>;

    expect(productJsonLd["@type"]).toBe("Product");
    expect(productJsonLd.name).toBe("Temiz bebek arabası");
    expect(productJsonLd.category).toBe("Bebek Arabaları");
    expect(productJsonLd.url).toBe("https://babyloop.test/listings/listing-seo-1");
    expect(productJsonLd.offers).toEqual(
      expect.objectContaining({
        "@type": "Offer",
        priceCurrency: "TRY",
        price: "1250"
      })
    );

    expect(breadcrumbJsonLd["@type"]).toBe("BreadcrumbList");
    expect(breadcrumbJsonLd.itemListElement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position: 3,
          name: "Bebek Arabaları listings",
          item: "https://babyloop.test/categories/strollers"
        }),
        expect.objectContaining({
          position: 4,
          name: "Temiz bebek arabası",
          item: "https://babyloop.test/listings/listing-seo-1"
        })
      ])
    );
  });

  it("escapes structured data script payloads", () => {
    expect(serializeStructuredData({ value: "<script>alert(1)</script>" })).not.toContain("<script>");
    expect(serializeStructuredData({ value: "<script>alert(1)</script>" })).toContain("\\u003cscript>");
  });
});

function createListingDetail({ status }: { status: string }): ListingDetail {
  return {
    id: "listing-seo-1",
    title: "Temiz bebek arabası",
    description: "Az kullanılmış, temiz ve teslimata hazır bebek arabası.",
    status,
    listingType: "sale",
    condition: "good",
    favoriteCount: 2,
    price: {
      amount: "1250",
      currency: "TRY"
    },
    category: {
      id: "category-strollers",
      name: "Bebek Arabaları",
      slug: "strollers"
    },
    firstImage: {
      id: "image-seo-1",
      url: "/uploads/listings/listing-seo-1/photo.jpg",
      status: "approved",
      sortOrder: 0
    },
    images: [
      {
        id: "image-seo-1",
        url: "/uploads/listings/listing-seo-1/photo.jpg",
        status: "approved",
        sortOrder: 0
      }
    ],
    seller: {
      profileId: "seller-profile-seo-1",
      displayName: "SEO Seller",
      locationCity: "İstanbul",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z"
  } as unknown as ListingDetail;
}
