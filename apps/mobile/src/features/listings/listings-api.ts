import { apiGet, isRecord, resolveApiAssetUrl, safeApiErrorMessage } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import {
  formatMobileListingCondition,
  formatMobileListingStatus,
  formatMobileListingType
} from "./listing-labels";

export type MobileListingStatus = "draft" | "active" | "reserved" | "sold" | "archived";
export type MobileListingPublicationState =
  | "awaiting_images"
  | "ai_review"
  | "admin_review"
  | "scheduled"
  | "published"
  | "changes_requested";
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
  publicationState: MobileListingPublicationState;
  publishAfter: string | null;
  publishedAt: string | null;
  publicationReviewReason: string | null;
  recommendedAgeMinMonths: number | null;
  recommendedAgeMaxMonths: number | null;
};

export type MobileListingDetail = MobileListingSummary & {
  description: string | null;
  createdAt: string | null;
  sellerProfileId: string | null;
  sellerDisplayName: string | null;
  favoriteCount: number | null;
  viewerState: {
    isFavorited: boolean;
    isOwner: boolean;
  };
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
  offset?: number;
  priceMax?: string;
  priceMin?: string;
  includeTotal?: boolean;
  imageLimit?: number;
};


export type MobileListingsPage = {
  listings: MobileListingSummary[];
  pagination: {
    hasNextPage: boolean;
    limit: number;
    offset: number;
    total: number | null;
    nextOffset: number | null;
  };
};

export type FetchMobileListingsOptions = {
  signal?: AbortSignal;
};

export async function fetchMobileListings(
  params: FetchMobileListingsParams = {},
  options: FetchMobileListingsOptions = {}
): Promise<MobileListingSummary[]> {
  const page = await fetchMobileListingsPage(params, options);
  return page.listings;
}

export async function fetchMobileListingsPage(
  params: FetchMobileListingsParams = {},
  options: FetchMobileListingsOptions = {}
): Promise<MobileListingsPage> {
  const query = buildMobileListingsQuery(params);
  const result = await apiGet<unknown>(`/api/v1/listings?${query.toString()}`, {
    signal: options.signal
  });

  if (options.signal?.aborted) {
    throw createAbortError();
  }

  if (!result.ok) {
    throw new Error(result.error);
  }

  return {
    listings: extractListingArray(result.data).map(normalizeMobileListingSummary),
    pagination: extractMobileListingsPagination(result.data, params)
  };
}

export function buildMobileListingsQuery(params: FetchMobileListingsParams = {}): URLSearchParams {
  const query = new URLSearchParams({
    imageLimit: String(params.imageLimit ?? 1),
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
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

  if (params.includeTotal === false) {
    query.set("includeTotal", "false");
  }

  return query;
}

function setTrimmedQueryParam(query: URLSearchParams, key: string, value: string | undefined): void {
  const normalized = value?.trim();

  if (normalized) {
    query.set(key, normalized);
  }
}

export async function fetchMobileListingDetail(
  listingId: string,
  options: FetchMobileListingsOptions = {}
): Promise<MobileListingDetail> {
  const response = await mobileAuthFetch(`/api/v1/listings/${encodeURIComponent(listingId)}`, {
    signal: options.signal
  });
  const payload: unknown = await response.json().catch(() => null);

  if (options.signal?.aborted) {
    throw createAbortError();
  }

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "İlan detayı yüklenemedi."));
  }

  return normalizeListingDetail(extractListingObject(payload));
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

export function normalizeMobileListingSummary(value: unknown): MobileListingSummary {
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
    statusText: formatMobileListingStatus(status),
    publicationState: normalizePublicationState(pickString(record, ["publicationState", "publication_state"])),
    publishAfter: pickString(record, ["publishAfter", "publish_after"]) ?? null,
    publishedAt: pickString(record, ["publishedAt", "published_at"]) ?? null,
    publicationReviewReason:
      pickString(record, ["publicationReviewReason", "publication_review_reason"]) ?? null,
    recommendedAgeMinMonths: pickNumber(record, [
      "recommendedAgeMinMonths",
      "recommended_age_min_months"
    ]),
    recommendedAgeMaxMonths: pickNumber(record, [
      "recommendedAgeMaxMonths",
      "recommended_age_max_months"
    ])
  };
}

function normalizeListingDetail(value: unknown): MobileListingDetail {
  const record = isRecord(value) ? value : {};
  const summary = normalizeMobileListingSummary(record);

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
    favoriteCount: pickNumber(record, ["favoriteCount", "favoritesCount"]),
    viewerState: normalizeMobileListingViewerState(record.viewerState)
  };
}

function normalizeMyListingSummary(value: unknown): MobileMyListingSummary {
  const record = isRecord(value) ? value : {};
  const summary = normalizeMobileListingSummary(record);

  return {
    ...summary,
    createdAt: pickString(record, ["createdAt", "created_at"]) ?? null,
    favoriteCount: pickNumber(record, ["favoriteCount", "favoritesCount"])
  };
}


function extractMobileListingsPagination(
  payload: unknown,
  params: FetchMobileListingsParams
): MobileListingsPage["pagination"] {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  const pagination = isRecord(root) && isRecord(root.pagination) ? root.pagination : {};
  const limit = pickNumber(pagination, ["limit"]) ?? params.limit ?? 20;
  const offset = pickNumber(pagination, ["offset"]) ?? params.offset ?? 0;
  const total = pickNumber(pagination, ["total"]);
  const listingCount = extractListingArray(payload).length;
  const hasNextPage = typeof pagination.hasNextPage === "boolean"
    ? pagination.hasNextPage
    : total !== null
      ? offset + listingCount < total
      : listingCount === limit;
  const nextOffset = pickNumber(pagination, ["nextOffset"]) ?? (
    hasNextPage ? offset + listingCount : null
  );

  return { hasNextPage, limit, nextOffset, offset, total };
}

function normalizeMobileListingViewerState(value: unknown): MobileListingDetail["viewerState"] {
  const record = isRecord(value) ? value : {};

  return {
    isFavorited: record.isFavorited === true,
    isOwner: record.isOwner === true
  };
}

function createAbortError(): Error {
  const error = new Error("Request aborted.");
  error.name = "AbortError";
  return error;
}

function normalizePublicationState(value: string | null): MobileListingPublicationState {
  if (
    value === "awaiting_images" ||
    value === "ai_review" ||
    value === "admin_review" ||
    value === "scheduled" ||
    value === "published" ||
    value === "changes_requested"
  ) {
    return value;
  }

  return "awaiting_images";
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


export type MobileListingImageReviewStatus =
  | "pending"
  | "approved"
  | "needs_review"
  | "rejected";

export type MobileEditableListingImage = {
  id: string;
  reviewStatus: MobileListingImageReviewStatus | null;
  reviewStatusText: string;
  sortOrder: number;
  url: string;
};

export type MobileEditableListingDetail = MobileListingDetail & {
  categoryId: string | null;
  condition: string | null;
  description: string;
  editableImages: MobileEditableListingImage[];
  listingType: string | null;
  priceAmount: string;
};

export type MobileListingUpdatePayload = {
  categoryId?: string;
  condition?: string;
  currency?: string;
  description?: string;
  listingType?: string;
  priceAmount?: string | null;
  recommendedAgeMinMonths?: number | null;
  recommendedAgeMaxMonths?: number | null;
  title?: string;
};

export type MobileListingEditUploadFile = {
  name: string;
  type: "image/jpeg" | "image/png" | "image/webp";
  uri: string;
};

export async function fetchMobileEditableListingDetail(
  listingId: string
): Promise<MobileEditableListingDetail> {
  const response = await mobileAuthFetch(`/api/v1/me/listings/${encodeURIComponent(listingId)}`);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(payload, "İlan düzenleme bilgileri şu an yüklenemedi.")
    );
  }

  const listing = extractMobileEditListingObject(payload);
  const detail = normalizeListingDetail(listing);

  return {
    ...detail,
    categoryId: pickMobileEditString(listing, ["categoryId"]) ?? pickMobileEditNestedString(listing, ["category", "id"]),
    condition: pickMobileEditString(listing, ["condition"]),
    description: pickMobileEditString(listing, ["description"]) ?? "",
    editableImages: normalizeMobileEditableListingImages(listing),
    listingType: pickMobileEditString(listing, ["listingType"]),
    priceAmount: pickMobileEditNestedString(listing, ["price", "amount"]) ?? "",
    recommendedAgeMinMonths: pickMobileEditNumber(listing, ["recommendedAgeMinMonths"]),
    recommendedAgeMaxMonths: pickMobileEditNumber(listing, ["recommendedAgeMaxMonths"])
  };
}

export async function updateMobileListing(
  listingId: string,
  payload: MobileListingUpdatePayload
): Promise<MobileListingSummary> {
  const response = await mobileAuthFetch(`/api/v1/listings/${encodeURIComponent(listingId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const responsePayload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(responsePayload, "İlan bilgileri şu an güncellenemedi.")
    );
  }

  return normalizeMobileListingSummary(extractListingObject(responsePayload));
}

export async function uploadMobileListingEditImage(
  listingId: string,
  image: MobileListingEditUploadFile
): Promise<MobileEditableListingImage> {
  const formData = new FormData();

  formData.append("image", {
    uri: image.uri,
    name: image.name,
    type: image.type
  } as unknown as Blob);

  const response = await mobileAuthFetch(
    `/api/v1/listings/${encodeURIComponent(listingId)}/images`,
    {
      method: "POST",
      body: formData
    }
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "Görsel şu an yüklenemedi."));
  }

  const imagePayload = extractMobileEditImageObject(payload);

  return normalizeMobileEditableListingImage(imagePayload);
}

export async function deleteMobileListingImage(
  listingId: string,
  imageId: string
): Promise<void> {
  const response = await mobileAuthFetch(
    `/api/v1/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE"
    }
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "Görsel şu an silinemedi."));
  }
}

export async function reorderMobileListingImages(
  listingId: string,
  imageIds: string[]
): Promise<MobileEditableListingImage[]> {
  const response = await mobileAuthFetch(
    `/api/v1/listings/${encodeURIComponent(listingId)}/images/reorder`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ imageIds })
    }
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "Görsel sırası şu an güncellenemedi."));
  }

  const images = extractMobileEditImagesArray(payload);

  return images.map(normalizeMobileEditableListingImage);
}

function extractMobileEditListingObject(payload: unknown): Record<string, unknown> {
  if (isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.listing)) {
    return payload.data.listing;
  }

  if (isRecord(payload) && isRecord(payload.listing)) {
    return payload.listing;
  }

  if (isRecord(payload)) {
    return payload;
  }

  throw new Error("İlan düzenleme yanıtı okunamadı.");
}

function extractMobileEditImageObject(payload: unknown): Record<string, unknown> {
  if (isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.image)) {
    return payload.data.image;
  }

  if (isRecord(payload) && isRecord(payload.image)) {
    return payload.image;
  }

  if (isRecord(payload)) {
    return payload;
  }

  throw new Error("Görsel yanıtı okunamadı.");
}

function extractMobileEditImagesArray(payload: unknown): Record<string, unknown>[] {
  const rawImages = isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.images)
    ? payload.data.images
    : isRecord(payload) && Array.isArray(payload.images)
      ? payload.images
      : [];

  return rawImages.filter(isRecord);
}

function normalizeMobileEditableListingImages(
  listing: Record<string, unknown>
): MobileEditableListingImage[] {
  const images = Array.isArray(listing.images) ? listing.images : [];

  return images.filter(isRecord).map(normalizeMobileEditableListingImage);
}

function normalizeMobileEditableListingImage(
  image: Record<string, unknown>
): MobileEditableListingImage {
  const id = pickMobileEditString(image, ["id"]);
  const url = resolveApiAssetUrl(pickMobileEditString(image, ["url", "imageUrl", "publicUrl"]));
  const reviewStatus = normalizeMobileImageReviewStatus(
    pickMobileEditString(image, ["reviewStatus", "status"])
  );
  const sortOrder = pickMobileEditNumber(image, ["sortOrder", "order"]) ?? 0;

  if (!id || !url) {
    throw new Error("Görsel yanıtı eksik döndü.");
  }

  return {
    id,
    reviewStatus,
    reviewStatusText: formatMobileImageReviewStatus(reviewStatus),
    sortOrder,
    url
  };
}

function normalizeMobileImageReviewStatus(
  value: string | null
): MobileListingImageReviewStatus | null {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "needs_review" ||
    value === "rejected"
  ) {
    return value;
  }

  return null;
}

export function formatMobileImageReviewStatus(
  value: MobileListingImageReviewStatus | null
): string {
  switch (value) {
    case "approved":
      return "Onaylandı";
    case "needs_review":
      return "İncelemede";
    case "rejected":
      return "Reddedildi";
    case "pending":
      return "Bekliyor";
    default:
      return "Durum yok";
  }
}

function pickMobileEditString(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function pickMobileEditNumber(
  record: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function pickMobileEditNestedString(
  record: Record<string, unknown>,
  path: [string, string]
): string | null {
  const parent = record[path[0]];

  if (!isRecord(parent)) {
    return null;
  }

  return pickMobileEditString(parent, [path[1]]);
}
