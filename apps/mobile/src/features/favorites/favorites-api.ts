import { isRecord, resolveApiAssetUrl } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import { fetchMobileListingDetail } from "../listings/listings-api";

export type MobileFavoriteListing = {
  id: string;
  title: string;
  priceText: string;
  locationText: string;
  imageUrl: string | null;
  conditionText: string | null;
  favoritedAt: string | null;
};

type MobileApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type MobileApiSuccess<T> = {
  ok: true;
  data: T;
};

type MobileApiResponse<T> = MobileApiSuccess<T> | MobileApiFailure;

export async function fetchMobileFavorites(): Promise<MobileFavoriteListing[]> {
  const response = await mobileAuthFetch("/api/v1/favorites");

  if (response.status === 401 || response.status === 403) {
    throw new Error("Favorileri görmek için giriş yap.");
  }

  const body = await parseApiResponse<unknown>(response);

  if (!body.ok) {
    throw new Error(body.error.message);
  }

  const favorites = extractFavoriteArray(body.data).map(normalizeFavoriteListing);

  return Promise.all(favorites.map(enrichFavoriteListing));
}


export async function saveMobileFavorite(
  listingId: string,
  isFavorited: boolean
): Promise<boolean> {
  const response = await mobileAuthFetch("/api/v1/favorites", {
    method: isFavorited ? "DELETE" : "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      listingId
    })
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Favoriye eklemek için giriş yap.");
  }

  const body = await parseApiResponse<unknown>(response);

  if (!body.ok) {
    throw new Error(body.error.message);
  }

  return !isFavorited;
}

async function parseApiResponse<T>(response: Response): Promise<MobileApiResponse<T>> {
  const payload: unknown = await response.json().catch(() => null);

  if (isApiResponse<T>(payload)) {
    return payload;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: `HTTP_${response.status}`,
        message: `Request failed with status ${response.status}.`
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "INVALID_API_RESPONSE",
      message: "BabyLoop API returned an invalid favorites response."
    }
  };
}

function isApiResponse<T>(payload: unknown): payload is MobileApiResponse<T> {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") {
    return false;
  }

  if (payload.ok === true) {
    return "data" in payload;
  }

  return isRecord(payload.error) && typeof payload.error.message === "string";
}

function extractFavoriteArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.favorites)) {
    return payload.favorites;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.listings)) {
    return payload.listings;
  }

  if (isRecord(payload.data)) {
    return extractFavoriteArray(payload.data);
  }

  return [];
}

function normalizeFavoriteListing(value: unknown): MobileFavoriteListing {
  const record = isRecord(value) ? value : {};
  const listing = isRecord(record.listing) ? record.listing : record;

  const title = pickString(listing, ["title", "name"]) ?? "İlan";
  const id = pickString(listing, ["id", "listingId"]) ?? pickString(record, ["listingId", "id"]) ?? title;

  return {
    id,
    title,
    priceText: formatPrice(listing),
    locationText:
      pickString(listing, ["locationCity", "city", "sellerCity"]) ??
      pickNestedString(listing, ["location", "city"]) ??
      pickNestedString(listing, ["seller", "locationCity"]) ??
      "Konum belirtilmedi",
    imageUrl: resolveApiAssetUrl(extractImageUrl(listing)),
    conditionText: pickString(listing, ["condition", "conditionLabel"]) ?? null,
    favoritedAt: pickString(record, ["favoritedAt", "createdAt", "created_at"]) ?? null
  };
}

async function enrichFavoriteListing(favorite: MobileFavoriteListing): Promise<MobileFavoriteListing> {
  if (favorite.imageUrl && favorite.locationText !== "Konum belirtilmedi") {
    return favorite;
  }

  try {
    const detail = await fetchMobileListingDetail(favorite.id);

    return {
      ...favorite,
      imageUrl: favorite.imageUrl ?? detail.imageUrl,
      locationText: favorite.locationText === "Konum belirtilmedi" ? detail.locationText : favorite.locationText,
      conditionText: favorite.conditionText ?? detail.conditionText,
      priceText: favorite.priceText === "Fiyat belirtilmedi" ? detail.priceText : favorite.priceText
    };
  } catch {
    return favorite;
  }
}

function formatPrice(record: Record<string, unknown>): string {
  const objectPrice = formatPriceObject(record.price);

  if (objectPrice) {
    return objectPrice;
  }

  const directPrice = pickString(record, ["price", "priceText", "formattedPrice"]);

  if (directPrice) {
    return directPrice;
  }

  const numericPrice = pickNumber(record, ["priceAmount", "priceValue", "amount"]);

  if (typeof numericPrice === "number") {
    return formatMoney(numericPrice, pickString(record, ["currency"]) ?? "TRY");
  }

  const cents = pickNumber(record, ["priceCents", "priceInCents"]);

  if (typeof cents === "number") {
    return formatMoney(cents / 100, pickString(record, ["currency"]) ?? "TRY");
  }

  return "Fiyat belirtilmedi";
}

function extractImageUrl(record: Record<string, unknown>): string | null {
  const direct = pickString(record, ["imageUrl", "coverImageUrl", "thumbnailUrl"]);

  if (direct) {
    return direct;
  }

  const firstImage = record.firstImage;

  if (isRecord(firstImage)) {
    const url = pickString(firstImage, ["url", "imageUrl", "publicUrl"]);

    if (url) {
      return url;
    }
  }

  const images = record.images;

  if (Array.isArray(images)) {
    for (const image of images) {
      if (typeof image === "string") {
        return image;
      }

      if (isRecord(image)) {
        const url = pickString(image, ["url", "imageUrl", "publicUrl"]);

        if (url) {
          return url;
        }
      }
    }
  }

  return null;
}

function formatPriceObject(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const amount = pickNumber(value, ["amount", "value", "priceAmount"]);
  const currency = pickString(value, ["currency"]) ?? "TRY";

  return typeof amount === "number" ? formatMoney(amount, currency) : null;
}

function formatMoney(amount: number, currency: string): string {
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  const formatted = amount.toLocaleString("tr-TR", {
    maximumFractionDigits: hasDecimals ? 2 : 0,
    minimumFractionDigits: hasDecimals ? 2 : 0
  });

  return `${formatted} ${currency === "TRY" ? "TL" : currency}`;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function pickNestedString(record: Record<string, unknown>, path: [string, string]): string | null {
  const parent = record[path[0]];

  if (!isRecord(parent)) {
    return null;
  }

  const value = parent[path[1]];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}
