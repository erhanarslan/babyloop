import type { ApiResponse } from "@babyloop/shared";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:4000";

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

export type FavoriteListing = Omit<ListingSummary, "firstImage" | "createdAt"> & {
  favoritedAt: string;
};

export type CategoriesPayload = {
  categories: Category[];
};

export type ListingsPayload = {
  listings: ListingSummary[];
};

export type ListingDetailPayload = {
  listing: ListingDetail;
};

export type FavoritesPayload = {
  favorites: FavoriteListing[];
};

export function getApiBaseUrl(): string {
  return (process.env.BABYLOOP_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
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
