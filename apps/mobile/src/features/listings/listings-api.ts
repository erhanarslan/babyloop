import { apiGet, isRecord, resolveApiAssetUrl, safeApiErrorMessage } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import {
  formatMobileListingCondition,
  formatMobileListingStatus,
  formatMobileListingType
} from "./listing-labels";

export type MobileListingStatus = "active" | "reserved" | "sold" | "archived";
export type MobileListingTypeFilter = "sale" | "donation" | "swap";
export type MobileListingConditionFilter = "new" | "like_new" | "good" | "fair" | "needs_repair";
export type MobileListingCreatedSinceFilter = "today" | "last_7_days";

export type MobileListingSummary = {
  id: string;
  title: string;
  priceText: string;
  locationText: string;
  imageUrl: string | null;
  imageUrls: string[];
  conditionText: string | null;
  listingType: string | null;
  listingTypeText: string;
  status: string | null;
  statusText: string;
};

export type MobileListingDetail = MobileListingSummary & {
  description: string | null;
  createdAt: string | null;
  sellerProfileId: string | null;
  sellerDisplayName: string | null;
  favoriteCount: number | null;
};

export type MobileMyListingSummary = MobileListingSummary & {
  createdAt: string | null;
  favoriteCount: number | null;
};

export type FetchMobileListingsParams = {
  categoryId?: string;
  city?: string;
  condition?: MobileListingConditionFilter;
  createdSince?: MobileListingCreatedSinceFilter;
  listingType?: MobileListingTypeFilter;
  q?: string;
  limit?: number;
  priceMax?: string;
  priceMin?: string;
};

export async function fetchMobileListings(
  params: FetchMobileListingsParams = {}
): Promise<MobileListingSummary[]> {
  const query = buildMobileListingsQuery(params);

  const result = await apiGet<unknown>(`/api/v1/listings?${query.toString()}`);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return extractListingArray(result.data).map(normalizeListingSummary);
}

export function buildMobileListingsQuery(params: FetchMobileListingsParams = {}): URLSearchParams {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 20),
    offset: "0",
    sort: "newest"
  });

  setTrimmedQueryParam(query, "q", params.q);
  setTrimmedQueryParam(query, "categoryId", params.categoryId);
  setTrimmedQueryParam(query, "city", params.city);
  setTrimmedQueryParam(query, "createdSince", params.createdSince);
  setTrimmedQueryParam(query, "condition", params.condition);
  setTrimmedQueryParam(query, "listingType", params.listingType);
  setTrimmedQueryParam(query, "priceMin", params.priceMin);
  setTrimmedQueryParam(query, "priceMax", params.priceMax);

  return query;
}

function setTrimmedQueryParam(query: URLSearchParams, key: string, value: string | undefined): void {
  const normalized = value?.trim();

  if (normalized) {
    query.set(key, normalized);
  }
}

export async function fetchMobileListingDetail(listingId: string): Promise<MobileListingDetail> {
  const result = await apiGet<unknown>(`/api/v1/listings/${encodeURIComponent(listingId)}`);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return normalizeListingDetail(extractListingObject(result.data));
}

export async function fetchMobileMyListings(): Promise<MobileMyListingSummary[]> {
  const response = await mobileAuthFetch("/api/v1/me/listings");
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(payload, "İlanların şu an yüklenemedi. Biraz sonra tekrar dene.")
    );
  }

  return extractListingArray(payload).map(normalizeMyListingSummary);
}

export async function updateMobileListingStatus(
  listingId: string,
  status: MobileListingStatus
): Promise<MobileMyListingSummary> {
  const response = await mobileAuthFetch(`/api/v1/listings/${encodeURIComponent(listingId)}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ status })
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(payload, "İlan durumu şu an güncellenemedi. Biraz sonra tekrar dene.")
    );
  }

  return normalizeMyListingSummary(extractListingObject(payload));
}

function extractListingArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.listings)) {
    return payload.listings;
  }

  if (isRecord(payload.data)) {
    return extractListingArray(payload.data);
  }

  return [];
}

function extractListingObject(payload: unknown): unknown {
  if (isRecord(payload) && isRecord(payload.listing)) {
    return payload.listing;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return extractListingObject(payload.data);
  }

  return payload;
}

function normalizeListingSummary(value: unknown): MobileListingSummary {
  const record = isRecord(value) ? value : {};
  const listingType = pickString(record, ["listingType", "type"]);
  const status = pickString(record, ["status"]);
  const imageUrls = extractImageUrls(record)
    .map(resolveApiAssetUrl)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  const title = pickString(record, ["title", "name"]) ?? "İlan";
  const id = pickString(record, ["id", "listingId"]) ?? title;
  const priceText = formatPrice(record);
  const locationText =
    pickString(record, ["locationCity", "city", "sellerCity"]) ??
    pickNestedString(record, ["location", "city"]) ??
    pickNestedString(record, ["seller", "locationCity"]) ??
    "Konum belirtilmedi";

  return {
    id,
    title,
    priceText,
    locationText,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    conditionText: formatMobileListingCondition(pickString(record, ["condition", "conditionLabel"])),
    listingType,
    listingTypeText: formatMobileListingType(listingType),
    status,
    statusText: formatMobileListingStatus(status)
  };
}

function normalizeListingDetail(value: unknown): MobileListingDetail {
  const record = isRecord(value) ? value : {};
  const summary = normalizeListingSummary(record);

  return {
    ...summary,
    description: pickString(record, ["description", "body"]) ?? null,
    createdAt: pickString(record, ["createdAt", "created_at"]) ?? null,
    sellerProfileId:
      pickString(record, ["sellerProfileId", "profileId"]) ??
      pickNestedString(record, ["seller", "profileId"]) ??
      pickNestedString(record, ["seller", "id"]),
    sellerDisplayName:
      pickString(record, ["sellerDisplayName", "sellerName"]) ??
      pickNestedString(record, ["seller", "displayName"]) ??
      pickNestedString(record, ["seller", "name"]),
    favoriteCount: pickNumber(record, ["favoriteCount", "favoritesCount"])
  };
}

function normalizeMyListingSummary(value: unknown): MobileMyListingSummary {
  const record = isRecord(value) ? value : {};
  const summary = normalizeListingSummary(record);

  return {
    ...summary,
    createdAt: pickString(record, ["createdAt", "created_at"]) ?? null,
    favoriteCount: pickNumber(record, ["favoriteCount", "favoritesCount"])
  };
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

function extractImageUrls(record: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const pushUrl = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0 && !urls.includes(value.trim())) {
      urls.push(value.trim());
    }
  };

  pushUrl(pickString(record, ["imageUrl", "coverImageUrl", "thumbnailUrl"]));

  const firstImage = record.firstImage;

  if (isRecord(firstImage)) {
    pushUrl(pickString(firstImage, ["url", "imageUrl", "publicUrl"]));
  }

  const images = record.images;

  if (Array.isArray(images)) {
    for (const image of images) {
      if (typeof image === "string") {
        pushUrl(image);
      } else if (isRecord(image)) {
        pushUrl(pickString(image, ["url", "imageUrl", "publicUrl"]));
      }
    }
  }

  return urls;
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
