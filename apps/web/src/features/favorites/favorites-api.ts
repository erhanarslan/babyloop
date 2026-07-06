import { marketplaceJson } from "../marketplace/api-client";

export type FavoriteListing = {
  id: string;
  title: string;
  status?: string;
  city?: string | null;
  priceAmount?: string | null;
  currency?: string | null;
  imageUrl?: string | null;
  seller?: {
    profileId: string;
    displayName: string;
    locationCity?: string | null;
    createdAt?: string;
  } | null;
};

type FavoritesResponse = {
  listings?: FavoriteListing[];
  favorites?: FavoriteListing[];
  items?: FavoriteListing[];
};

function normalizeFavorites(data: FavoritesResponse | FavoriteListing[]): FavoriteListing[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data.listings ?? data.favorites ?? data.items ?? [];
}

export async function listFavoriteListings(): Promise<FavoriteListing[]> {
  return normalizeFavorites(await marketplaceJson<FavoritesResponse | FavoriteListing[]>("/api/v1/favorites"));
}

export async function removeFavoriteListing(listingId: string): Promise<void> {
  await marketplaceJson(`/api/v1/favorites/${encodeURIComponent(listingId)}`, {
    method: "DELETE"
  });
}
