export type MobileFavoriteListing = {
  id: string;
  title: string;
  city?: string | null;
  priceAmount?: string | null;
  currency?: string | null;
  imageUrl: string | null;
  conditionText: string | null;
  favoritedAt: string | null;
  locationText: string;
  priceText: string;
  seller?: {
    profileId: string;
    displayName: string;
    locationCity?: string | null;
  } | null;
};

export type MobileFavoritesApiClient = {
  apiBaseUrl?: string;
  accessToken?: string;
};

type RawMobileFavoriteListing = {
  id: string;
  title: string;
  city?: string | null;
  priceAmount?: string | null;
  currency?: string | null;
  imageUrl?: string | null;
  conditionText?: string | null;
  favoritedAt?: string | null;
  locationText?: string | null;
  priceText?: string | null;
  seller?: {
    profileId: string;
    displayName: string;
    locationCity?: string | null;
  } | null;
};

type FavoriteActionInput = MobileFavoritesApiClient | string | undefined;

type FavoritesResponse = {
  ok?: boolean;
  data?: {
    listings?: RawMobileFavoriteListing[];
    favorites?: RawMobileFavoriteListing[];
    items?: RawMobileFavoriteListing[];
  };
  listings?: RawMobileFavoriteListing[];
  favorites?: RawMobileFavoriteListing[];
  items?: RawMobileFavoriteListing[];
};

const DEFAULT_API_BASE_URL = "http://localhost:4000";

function resolveApiBaseUrl(client?: MobileFavoritesApiClient): string {
  return (client?.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function authHeaders(accessToken?: string): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function normalizePriceText(listing: RawMobileFavoriteListing): string {
  if (typeof listing.priceText === "string") {
    return listing.priceText;
  }

  if (listing.priceAmount) {
    return `${listing.priceAmount}${listing.currency ? ` ${listing.currency}` : ""}`;
  }

  return "Fiyat belirtilmemiş";
}

function normalizeLocationText(listing: RawMobileFavoriteListing): string {
  return listing.locationText ?? listing.city ?? listing.seller?.locationCity ?? "Konum belirtilmemiş";
}

function normalizeFavoriteListing(listing: RawMobileFavoriteListing): MobileFavoriteListing {
  return {
    id: listing.id,
    title: listing.title,
    city: listing.city,
    priceAmount: listing.priceAmount,
    currency: listing.currency,
    imageUrl: listing.imageUrl ?? null,
    conditionText: listing.conditionText ?? null,
    favoritedAt: listing.favoritedAt ?? null,
    locationText: normalizeLocationText(listing),
    priceText: normalizePriceText(listing),
    seller: listing.seller
  };
}

function normalizeFavorites(payload: FavoritesResponse): MobileFavoriteListing[] {
  const listings =
    payload.data?.listings ??
    payload.data?.favorites ??
    payload.data?.items ??
    payload.listings ??
    payload.favorites ??
    payload.items ??
    [];

  return listings.map(normalizeFavoriteListing);
}

function resolveClientAndListing(
  first?: FavoriteActionInput,
  second?: string | boolean
): { client: MobileFavoritesApiClient; listingId: string | undefined; nextFavoriteState: boolean | undefined } {
  if (typeof first === "string") {
    return {
      client: {},
      listingId: first,
      nextFavoriteState: typeof second === "boolean" ? second : undefined
    };
  }

  return {
    client: first ?? {},
    listingId: typeof second === "string" ? second : undefined,
    nextFavoriteState: undefined
  };
}

async function writeFavoriteState(
  client: MobileFavoritesApiClient,
  listingId: string,
  nextFavoriteState: boolean
): Promise<boolean> {
  const response = await fetch(`${resolveApiBaseUrl(client)}/api/v1/favorites/${encodeURIComponent(listingId)}`, {
    method: nextFavoriteState ? "POST" : "DELETE",
    headers: {
      Accept: "application/json",
      ...authHeaders(client.accessToken)
    }
  });

  if (!response.ok) {
    throw new Error(nextFavoriteState ? "Favorite could not be saved." : "Favorite could not be removed.");
  }

  return nextFavoriteState;
}

export async function fetchMobileFavorites(client: MobileFavoritesApiClient = {}): Promise<MobileFavoriteListing[]> {
  const response = await fetch(`${resolveApiBaseUrl(client)}/api/v1/favorites`, {
    headers: {
      Accept: "application/json",
      ...authHeaders(client.accessToken)
    }
  });

  if (!response.ok) {
    throw new Error("Favorites could not be loaded.");
  }

  return normalizeFavorites((await response.json()) as FavoritesResponse);
}

export async function saveMobileFavorite(
  first?: FavoriteActionInput,
  second?: string | boolean
): Promise<boolean> {
  const { client, listingId, nextFavoriteState } = resolveClientAndListing(first, second);

  if (!listingId) {
    return false;
  }

  return writeFavoriteState(client, listingId, nextFavoriteState ?? true);
}

export async function removeMobileFavorite(
  first?: FavoriteActionInput,
  second?: string
): Promise<boolean> {
  const { client, listingId } = resolveClientAndListing(first, second);

  if (!listingId) {
    return false;
  }

  return writeFavoriteState(client, listingId, false);
}
