export type CategoryBasicResponse = {
  id: string;
  name: string;
  slug: string;
};

export type ListingImageResponse = {
  id: string;
  url: string;
  sortOrder: number;
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
  listingType: string;
  condition: string;
  category: CategoryBasicResponse;
  firstImage: ListingImageResponse | null;
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
  listingType: string;
  condition: string;
  createdAt: Date;
  category: CategoryBasicResponse;
  firstImage: ListingImageResponse | null;
}): ListingSummaryResponse {
  return {
    id: value.id,
    title: value.title,
    price: buildPrice(value.priceAmount, value.currency),
    favoriteCount: value.favoriteCount ?? 0,
    status: value.status,
    listingType: value.listingType,
    condition: value.condition,
    category: value.category,
    firstImage: value.firstImage,
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
