import type { ApiResponse } from "@babyloop/shared";

const DEFAULT_API_BASE_URL = "http://localhost:4000";

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

export type ListingImage = {
  id: string;
  url: string;
  sortOrder: number;
};

export type ListingSummary = {
  id: string;
  title: string;
  price: {
    amount: string;
    currency: string;
  } | null;
  favoriteCount: number;
  status: string;
  listingType: string;
  condition: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  firstImage: ListingImage | null;
  createdAt: string;
};

export type ListingDetail = ListingSummary & {
  description: string | null;
  images: ListingImage[];
  seller: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    locationCity: string | null;
  };
  updatedAt: string;
};

export type FavoriteListing = Omit<ListingSummary, "favoriteCount" | "firstImage" | "createdAt"> & {
  favoritedAt: string;
};

export type CategoriesPayload = {
  categories: Category[];
};

export type ListingsPagination = {
  limit: number;
  offset: number;
  total: number;
  hasNextPage: boolean;
};

export type BrowseListingsFilters = {
  q: string;
  categoryId: string;
  condition: string;
  listingType: string;
  priceMin: string;
  priceMax: string;
  hasImages: string;
  sort: string;
  limit: number;
  offset: number;
};

export type ListingsPayload = {
  listings: ListingSummary[];
  pagination?: ListingsPagination;
};

export type SearchSuggestion = {
  kind: "category" | "listing";
  label: string;
  categoryId?: string;
  categorySlug?: string;
  listingId?: string;
};

export type SearchSuggestionsPayload = {
  suggestions: SearchSuggestion[];
};

export type ListingDetailPayload = {
  listing: ListingDetail;
};

export type ListingRecommendationsPayload = {
  recommendations: ListingSummary[];
};

export type FavoritesPayload = {
  favorites: FavoriteListing[];
};

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.BABYLOOP_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, "");
}

export async function fetchApi<TData>(path: string): Promise<ApiResponse<TData>> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store"
    });
    const body = (await response.json()) as ApiResponse<TData>;

    if (!response.ok && body.ok) {
      return {
        ok: false,
        error: {
          code: "API_ERROR",
          message: "API request failed."
        }
      };
    }

    return body;
  } catch {
    return {
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop API is unavailable."
      }
    };
  }
}
