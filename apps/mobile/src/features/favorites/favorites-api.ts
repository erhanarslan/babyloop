
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
  id?: unknown;
  listingId?: unknown;
  title?: unknown;
  city?: unknown;
  locationCity?: unknown;
  priceAmount?: unknown;
  currency?: unknown;
  imageUrl?: unknown;
  firstImage?: unknown;
  images?: unknown;
  condition?: unknown;
  conditionText?: unknown;
  favoritedAt?: unknown;
  locationText?: unknown;
  priceText?: unknown;
  seller?: unknown;
  listing?: unknown;
};

type FavoriteActionInput = MobileFavoritesApiClient | string | undefined;

type FavoritesResponse = {
  ok?: boolean;
  data?: {
    listings?: unknown;
    favorites?: unknown;
    items?: unknown;
  };
  listings?: unknown;
  favorites?: unknown;
  items?: unknown;
};

const DEFAULT_API_BASE_URL = "http://localhost:4000";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type MobileAuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

async function loadMobileAuthFetch(): Promise<MobileAuthFetch> {
  const authApi = await import("../auth/auth-api");
  return authApi.mobileAuthFetch;
}

const conditionLabels: Record<string, string> = {
  new: "Yeni",
  like_new: "Yeni gibi",
  good: "İyi",
  fair: "Orta",
  needs_repair: "Tamir gerekli"
};

function hasExplicitClient(client?: MobileFavoritesApiClient): boolean {
  return Boolean(client?.apiBaseUrl || client?.accessToken);
}

function resolveApiBaseUrl(client?: MobileFavoritesApiClient): string {
  return (client?.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function authHeaders(accessToken?: string): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function requestFavoritesApi(
  path: string,
  client: MobileFavoritesApiClient,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (hasExplicitClient(client)) {
    for (const [key, value] of Object.entries(authHeaders(client.accessToken))) {
      headers.set(key, value);
    }

    return fetch(`${resolveApiBaseUrl(client)}${path}`, {
      ...init,
      headers
    });
  }

  const mobileFetch = await loadMobileAuthFetch();

  return mobileFetch(path, {
    ...init,
    headers
  });
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizePriceText(listing: RawMobileFavoriteListing): string {
  const priceText = stringOrNull(listing.priceText);

  if (priceText) {
    return priceText;
  }

  const priceAmount =
    typeof listing.priceAmount === "number"
      ? String(listing.priceAmount)
      : stringOrNull(listing.priceAmount);

  if (priceAmount) {
    const currency = stringOrNull(listing.currency);
    return `${priceAmount}${currency ? ` ${currency}` : ""}`;
  }

  return "Fiyat belirtilmemiş";
}

function normalizeLocationText(listing: RawMobileFavoriteListing, seller: MobileFavoriteListing["seller"]): string {
  return (
    stringOrNull(listing.locationText) ??
    stringOrNull(listing.city) ??
    stringOrNull(listing.locationCity) ??
    seller?.locationCity ??
    "Konum belirtilmemiş"
  );
}

function normalizeSeller(value: unknown): MobileFavoriteListing["seller"] {
  if (!isRecord(value)) {
    return null;
  }

  const profileId = stringOrNull(value.profileId);
  const displayName = stringOrNull(value.displayName);

  if (!profileId || !displayName) {
    return null;
  }

  const seller: NonNullable<MobileFavoriteListing["seller"]> = {
    profileId,
    displayName
  };
  const locationCity = stringOrNull(value.locationCity);

  if (locationCity) {
    seller.locationCity = locationCity;
  }

  return seller;
}

function normalizeImageUrl(listing: RawMobileFavoriteListing): string | null {
  const directImageUrl = stringOrNull(listing.imageUrl);

  if (directImageUrl) {
    return directImageUrl;
  }

  if (isRecord(listing.firstImage)) {
    const firstImageUrl = stringOrNull(listing.firstImage.url);

    if (firstImageUrl) {
      return firstImageUrl;
    }
  }

  if (Array.isArray(listing.images)) {
    for (const image of listing.images) {
      if (isRecord(image)) {
        const imageUrl = stringOrNull(image.url);

        if (imageUrl) {
          return imageUrl;
        }
      }
    }
  }

  return null;
}

function normalizeConditionText(listing: RawMobileFavoriteListing): string | null {
  return stringOrNull(listing.conditionText) ?? conditionLabels[stringOrNull(listing.condition) ?? ""] ?? null;
}

function unwrapFavoriteListing(value: unknown): RawMobileFavoriteListing | null {
  if (!isRecord(value)) {
    return null;
  }

  if (isRecord(value.listing)) {
    return {
      ...value.listing,
      favoritedAt: value.favoritedAt ?? value.listing.favoritedAt
    };
  }

  return value;
}

function normalizeFavoriteListing(value: unknown): MobileFavoriteListing | null {
  const listing = unwrapFavoriteListing(value);

  if (!listing) {
    return null;
  }

  const id = stringOrNull(listing.id) ?? stringOrNull(listing.listingId);
  const title = stringOrNull(listing.title);

  if (!id || !title) {
    return null;
  }

  const seller = normalizeSeller(listing.seller);

  const normalized: MobileFavoriteListing = {
    id,
    title,
    imageUrl: normalizeImageUrl(listing),
    conditionText: normalizeConditionText(listing),
    favoritedAt: stringOrNull(listing.favoritedAt),
    locationText: normalizeLocationText(listing, seller),
    priceText: normalizePriceText(listing),
    seller
  };
  const city = stringOrNull(listing.city);
  const priceAmount =
    typeof listing.priceAmount === "number"
      ? String(listing.priceAmount)
      : stringOrNull(listing.priceAmount);
  const currency = stringOrNull(listing.currency);

  if (city) {
    normalized.city = city;
  }

  if (priceAmount) {
    normalized.priceAmount = priceAmount;
  }

  if (currency) {
    normalized.currency = currency;
  }

  return normalized;
}

function extractFavoriteArray(payload: FavoritesResponse): unknown[] {
  const candidates = [
    payload.data?.listings,
    payload.data?.favorites,
    payload.data?.items,
    payload.listings,
    payload.favorites,
    payload.items
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function normalizeFavorites(payload: FavoritesResponse): MobileFavoriteListing[] {
  return extractFavoriteArray(payload).flatMap((item) => {
    const listing = normalizeFavoriteListing(item);
    return listing ? [listing] : [];
  });
}

function resolveClientAndListing(
  first?: FavoriteActionInput,
  second?: string | boolean,
  third?: boolean
): { client: MobileFavoritesApiClient; listingId: string | undefined; nextFavoriteState: boolean | undefined } {
  if (typeof first === "string") {
    return {
      client: {},
      listingId: first,
      nextFavoriteState: typeof second === "boolean" ? second : third
    };
  }

  return {
    client: first ?? {},
    listingId: typeof second === "string" ? second : undefined,
    nextFavoriteState: typeof third === "boolean" ? third : undefined
  };
}

function extractApiError(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const directMessage = stringOrNull(payload.message);

  if (directMessage) {
    return directMessage;
  }

  const directError = stringOrNull(payload.error);

  if (directError) {
    return directError;
  }

  if (isRecord(payload.error)) {
    const nestedMessage =
      stringOrNull(payload.error.message) ??
      stringOrNull(payload.error.detail) ??
      stringOrNull(payload.error.code);

    if (nestedMessage) {
      return nestedMessage;
    }
  }

  if (isRecord(payload.data)) {
    const dataMessage =
      stringOrNull(payload.data.message) ??
      stringOrNull(payload.data.error);

    if (dataMessage) {
      return dataMessage;
    }
  }

  return null;
}


async function parseApiPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function writeFavoriteState(
  client: MobileFavoritesApiClient,
  listingId: string,
  nextFavoriteState: boolean
): Promise<boolean> {
  const init: RequestInit = {
    method: nextFavoriteState ? "POST" : "DELETE",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      listingId
    })
  };

  const primary = await requestFavoritesApi("/api/v1/favorites", client, init);
  const primaryPayload = await parseApiPayload(primary);

  if (primary.ok) {
    return nextFavoriteState;
  }

  if (shouldFallbackToPathFavoriteEndpoint(primary.status, primaryPayload)) {
    const fallback = await requestFavoritesApi(
      `/api/v1/favorites/${encodeURIComponent(listingId)}`,
      client,
      {
        method: nextFavoriteState ? "POST" : "DELETE"
      }
    );
    const fallbackPayload = await parseApiPayload(fallback);

    if (fallback.ok) {
      return nextFavoriteState;
    }

    throw new Error(
      extractApiError(fallbackPayload) ??
        extractApiError(primaryPayload) ??
        (nextFavoriteState ? "Favori kaydedilemedi." : "Favoriden çıkarılamadı.")
    );
  }

  throw new Error(
    extractApiError(primaryPayload) ??
      (nextFavoriteState ? "Favori kaydedilemedi." : "Favoriden çıkarılamadı.")
  );
}

function shouldFallbackToPathFavoriteEndpoint(status: number, payload: unknown): boolean {
  if (status === 404 || status === 405) {
    return true;
  }

  const message = extractApiError(payload)?.toLowerCase() ?? "";

  return status === 400 && (
    message.includes("listingid") ||
    message.includes("listing id") ||
    message.includes("invalid request") ||
    message.includes("required")
  );
}

export async function fetchMobileFavorites(client: MobileFavoritesApiClient = {}): Promise<MobileFavoriteListing[]> {
  const response = await requestFavoritesApi("/api/v1/favorites", client);
  const payload = await parseApiPayload(response);

  if (!response.ok) {
    throw new Error(extractApiError(payload) ?? "Favoriler yüklenemedi.");
  }

  return normalizeFavorites(payload as FavoritesResponse);
}

export async function saveMobileFavorite(
  first?: FavoriteActionInput,
  second?: string | boolean,
  third?: boolean
): Promise<boolean> {
  const { client, listingId, nextFavoriteState } = resolveClientAndListing(first, second, third);

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
