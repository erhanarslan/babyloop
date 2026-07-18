export type CategoryBasicResponse = {
  id: string;
  name: string;
  slug: string;
};

export type ListingImageReviewStatus = "pending" | "approved" | "needs_review" | "rejected";

export type ListingPublicationState =
  | "awaiting_images"
  | "ai_review"
  | "admin_review"
  | "scheduled"
  | "published"
  | "changes_requested";

export type ListingImageAuthenticityMetadata = {
  decision: "allow" | "needs_review" | "reject";
  confidence: number;
  providerName: string;
  modelName: string | null;
  promptVersion: string;
  reasons: string[];
  flags: Record<string, unknown>;
  checkedAt: string;
};

export type ListingImageResponse = {
  id: string;
  url: string;
  sortOrder: number;
  reviewStatus?: ListingImageReviewStatus;
  authenticity?: ListingImageAuthenticityMetadata | null;
};

export type PriceResponse = {
  amount: string;
  currency: string;
} | null;

export type ListingSummaryResponse = {
  id: string;
  title: string;
  price: PriceResponse;
  favoriteCount: number;
  status: string;
  publicationState: ListingPublicationState;
  publishAfter: string | null;
  publishedAt: string | null;
  publicationReviewReason: string | null;
  listingType: string;
  condition: string;
  category: CategoryBasicResponse;
  firstImage: ListingImageResponse | null;
  images: ListingImageResponse[];
  createdAt: string;
};

export type ListingDetailResponse = ListingSummaryResponse & {
  description: string | null;
  images: ListingImageResponse[];
  seller: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    locationCity: string | null;
  };
  updatedAt: string;
};

export function mapListingSummary(value: {
  id: string;
  title: string;
  priceAmount: string | null;
  currency: string;
  favoriteCount?: number;
  status: string;
  publicationState: ListingPublicationState;
  publishAfter: Date | null;
  publishedAt: Date | null;
  publicationReviewReason: string | null;
  listingType: string;
  condition: string;
  createdAt: Date;
  category: CategoryBasicResponse;
  firstImage: ListingImageResponse | null;
  images?: ListingImageResponse[];
}): ListingSummaryResponse {
  return {
    id: value.id,
    title: value.title,
    price: buildPrice(value.priceAmount, value.currency),
    favoriteCount: value.favoriteCount ?? 0,
    status: value.status,
    publicationState: value.publicationState,
    publishAfter: value.publishAfter?.toISOString() ?? null,
    publishedAt: value.publishedAt?.toISOString() ?? null,
    publicationReviewReason: value.publicationReviewReason,
    listingType: value.listingType,
    condition: value.condition,
    category: value.category,
    firstImage: value.firstImage,
    images: value.images ?? (value.firstImage ? [value.firstImage] : []),
    createdAt: value.createdAt.toISOString()
  };
}

export function buildPrice(amount: string | null, currency: string): PriceResponse {
  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency
  };
}
