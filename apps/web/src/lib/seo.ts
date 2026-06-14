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
  const isIndexable = isListingIndexable(listing);
  const imageUrl = listing.firstImage?.url ?? listing.images[0]?.url ?? null;
  const categoryName = listing.category.name;
  const conditionText = formatMetadataToken(listing.condition);
  const listingTypeText = formatMetadataToken(listing.listingType);
  const priceText = listing.price
    ? `${listing.price.amount} ${listing.price.currency}`
    : listing.listingType === "donation"
      ? "donation"
      : "price on request";

  return buildPublicPageMetadata({
    title: `${listing.title} in ${categoryName}`,
    description: `${listing.title} on BabyLoop: ${categoryName}, ${conditionText}, ${listingTypeText}, ${priceText}. Review photos, buyer checklist, seller-safe details, related listings, and messaging before meeting.`,
    path: `/listings/${listing.id}`,
    imageUrl,
    noIndex: !isIndexable
  });
}

export function buildListingJsonLd(listing: ListingDetail): Record<string, unknown> {
  const images = listing.images
    .map((image) => normalizeMetadataImage(image.url))
    .filter((url, index, urls) => urls.indexOf(url) === index);

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: buildListingStructuredDescription(listing),
    category: listing.category.name,
    url: buildCanonicalUrl(`/listings/${listing.id}`)
  };

  if (images.length > 0) {
    product.image = images;
  }

  product.offers = {
    "@type": "Offer",
    url: buildCanonicalUrl(`/listings/${listing.id}`),
    availability: getListingAvailabilitySchema(listing.status),
    itemCondition: getListingConditionSchema(listing.condition),
    priceCurrency: listing.price?.currency ?? "TRY",
    price: listing.price?.amount ?? (listing.listingType === "donation" ? "0" : undefined)
  };

  return product;
}

export function buildListingBreadcrumbJsonLd(listing: ListingDetail): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: buildCanonicalUrl("/")
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Browse marketplace",
        item: buildCanonicalUrl("/browse")
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${listing.category.name} listings`,
        item: buildCanonicalUrl(`/categories/${listing.category.slug}`)
      },
      {
        "@type": "ListItem",
        position: 4,
        name: listing.title,
        item: buildCanonicalUrl(`/listings/${listing.id}`)
      }
    ]
  };
}

export function serializeStructuredData(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function isListingIndexable(listing: ListingDetail): boolean {
  return listing.status === "active" || listing.status === "reserved";
}

function buildListingStructuredDescription(listing: ListingDetail): string {
  const fallback = `${listing.title} in ${listing.category.name}: ${formatMetadataToken(
    listing.condition
  )}, ${formatMetadataToken(listing.listingType)}.`;

  return compactMetadataText(listing.description ?? fallback, 500);
}

function getListingAvailabilitySchema(status: string): string {
  switch (status) {
    case "active":
      return "https://schema.org/InStock";
    case "reserved":
      return "https://schema.org/LimitedAvailability";
    case "sold":
      return "https://schema.org/SoldOut";
    default:
      return "https://schema.org/OutOfStock";
  }
}

function getListingConditionSchema(condition: string): string {
  switch (condition) {
    case "new":
      return "https://schema.org/NewCondition";
    case "like_new":
    case "good":
    case "fair":
      return "https://schema.org/UsedCondition";
    case "needs_repair":
      return "https://schema.org/DamagedCondition";
    default:
      return "https://schema.org/UsedCondition";
  }
}

function compactMetadataText(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/g, " ").trim();

  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, maxLength - 1).trim()}…`;
}

function formatMetadataToken(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
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
