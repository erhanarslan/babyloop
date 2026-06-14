import type { Metadata } from "next";
import type { Category, ListingDetail } from "./api";
import { getApiBaseUrl } from "./api";

export const SITE_NAME = "BabyLoop";
export const SITE_TAGLINE = "Parent marketplace for baby and child essentials";
export const SITE_DESCRIPTION =
  "BabyLoop helps parents buy, sell, donate, and reuse baby and child essentials with safer listings, guided discovery, and marketplace-focused AI help.";

export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";

type MetadataRobots = NonNullable<Metadata["robots"]>;

type PublicPageMetadataInput = {
  description: string;
  imageUrl?: string | null;
  noIndex?: boolean;
  path: string;
  title: string;
};

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BABYLOOP_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function buildCanonicalUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return new URL(normalizedPath, getSiteUrl()).toString();
}

export function buildPublicPageMetadata({
  description,
  imageUrl,
  noIndex = false,
  path,
  title
}: PublicPageMetadataInput): Metadata {
  const canonicalUrl = buildCanonicalUrl(path);
  const fullTitle = formatFullTitle(title);
  const image = normalizeMetadataImage(imageUrl);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title: fullTitle,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} marketplace preview`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image]
    },
    robots: noIndex ? noIndexRobots() : indexRobots()
  };
}

export function buildNoIndexMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: noIndexRobots()
  };
}

export function buildCategoryMetadata(category: Category, noIndex = false): Metadata {
  return buildPublicPageMetadata({
    title: `${category.name} listings for parents`,
    description: `Browse parent-owned ${category.name} listings on BabyLoop with condition notes, price filters, photos, saved searches, parent guides, and second-hand buying checks before messaging a seller.`,
    path: `/categories/${category.slug}`,
    noIndex
  });
}

export function buildListingMetadata(listing: ListingDetail): Metadata {
  const isIndexable = listing.status === "active" || listing.status === "reserved";
  const imageUrl = listing.firstImage?.url ?? listing.images[0]?.url ?? null;
  const priceText = listing.price
    ? `${listing.price.amount} ${listing.price.currency}`
    : "price on request";

  return buildPublicPageMetadata({
    title: listing.title,
    description: `${listing.title} on BabyLoop: ${listing.category.name}, ${listing.condition}, ${priceText}. Review photos, seller-safe details, buyer checklist, related listings, and messaging before meeting.`,
    path: `/listings/${listing.id}`,
    imageUrl,
    noIndex: !isIndexable
  });
}

export function buildFilteredBrowseNoIndexMetadata(title = "Filtered marketplace results"): Metadata {
  return buildNoIndexMetadata(
    title,
    "Filtered BabyLoop marketplace results are available for browsing, but canonical marketplace discovery starts from the main browse and category pages."
  );
}

export function normalizeMetadataImage(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return buildCanonicalUrl(DEFAULT_OG_IMAGE_PATH);
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `${getApiBaseUrl()}${imageUrl}`;
  }

  return buildCanonicalUrl(DEFAULT_OG_IMAGE_PATH);
}

export function noIndexRobots(): MetadataRobots {
  return {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  };
}

export function indexRobots(): MetadataRobots {
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  };
}

function formatFullTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}
