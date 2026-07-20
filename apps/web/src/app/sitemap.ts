import type { MetadataRoute } from "next";
import { parentGuideTopics } from "../features/parent-guides/parent-guide-data";
import {
  fetchApi,
  type CategoriesPayload,
  type ListingsPayload
} from "../lib/api";
import { buildCanonicalUrl } from "../lib/seo";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [categoriesResult, listingsResult] = await Promise.all([
    fetchApi<CategoriesPayload>("/api/v1/categories", { revalidate: 300 }),
    fetchApi<ListingsPayload>(
      "/api/v1/listings?limit=50&sort=newest&hasImages=true&imageLimit=1",
      { revalidate: 300 }
    )
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: buildCanonicalUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: buildCanonicalUrl("/browse"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9
    },
    {
      url: buildCanonicalUrl("/guides"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7
    },
    {
      url: buildCanonicalUrl("/assistant"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6
    },
    ...[
      "/legal/privacy",
      "/legal/kvkk",
      "/legal/terms",
      "/legal/cookies",
      "/legal/ai-notice",
      "/legal/marketplace",
      "/legal/data-deletion",
      "/support/contact"
    ].map((path) => ({
      url: buildCanonicalUrl(path),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.35
    }))
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categoriesResult.ok
    ? categoriesResult.data.categories.map((category) => ({
        url: buildCanonicalUrl(`/categories/${category.slug}`),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8
      }))
    : [];

  const guideRoutes: MetadataRoute.Sitemap = parentGuideTopics.map((topic) => ({
    url: buildCanonicalUrl(`/guides/${topic.id}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.65
  }));

  const listingRoutes: MetadataRoute.Sitemap = listingsResult.ok
    ? listingsResult.data.listings
        .filter((listing) => listing.status === "active" || listing.status === "reserved")
        .map((listing) => ({
          url: buildCanonicalUrl(`/listings/${listing.id}`),
          lastModified: new Date(listing.createdAt),
          changeFrequency: "daily",
          priority: 0.75
        }))
    : [];

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...guideRoutes,
    ...listingRoutes
  ];
}
