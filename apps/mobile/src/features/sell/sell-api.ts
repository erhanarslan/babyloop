import { apiGet, isRecord, safeApiErrorMessage } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import type {
  MobileListingPublicationState,
  MobileListingStatus,
  MobileListingSummary
} from "../listings/listings-api";
import type { MobileCreateListingPayload } from "./sell-form-model";
import type { MobileListingImageUploadFile } from "./image-upload-model";

export type MobileCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

export async function fetchMobileCategories(): Promise<MobileCategory[]> {
  const result = await apiGet<unknown>("/api/v1/categories");

  if (!result.ok) {
    throw new Error(result.error);
  }

  return extractCategoryArray(result.data).map(normalizeCategory).filter(isMobileCategory);
}


export async function uploadMobileListingImage(
  listingId: string,
  image: MobileListingImageUploadFile
): Promise<{ reviewStatus: "approved" | "needs_review" | "pending" | "rejected" | null }> {
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
  const responsePayload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(responsePayload, "Görsel şu an yüklenemedi. Biraz sonra tekrar dene.")
    );
  }

  const data = unwrapApiData(responsePayload);
  const imagePayload = isRecord(data) && isRecord(data.image) ? data.image : null;
  const reviewStatus = imagePayload ? pickString(imagePayload, ["reviewStatus"]) : null;

  return {
    reviewStatus:
      reviewStatus === "approved" ||
      reviewStatus === "needs_review" ||
      reviewStatus === "pending" ||
      reviewStatus === "rejected"
        ? reviewStatus
        : null
  };
}

export async function createMobileListing(
  payload: MobileCreateListingPayload
): Promise<MobileListingSummary> {
  const response = await mobileAuthFetch("/api/v1/listings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const responsePayload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      safeApiErrorMessage(responsePayload, "İlan şu an oluşturulamadı. Biraz sonra tekrar dene.")
    );
  }

  const listing = extractListingObject(unwrapApiData(responsePayload));

  if (!isRecord(listing)) {
    throw new Error("İlan oluşturuldu ancak API yanıtı okunamadı.");
  }

  const id = pickString(listing, ["id", "listingId"]);
  const title = pickString(listing, ["title", "name"]) ?? payload.title;
  const price = isRecord(listing.price) ? listing.price : null;
  const priceText =
    formatPriceObject(price) ??
    (payload.priceAmount ? `${payload.priceAmount} TL` : "Fiyat belirtilmedi");
  const status = normalizeListingStatus(pickString(listing, ["status"]));

  if (!id) {
    throw new Error("İlan oluşturuldu ancak ilan id bilgisi alınamadı.");
  }

  return {
    id,
    title,
    priceText,
    locationText: "Konum belirtilmedi",
    imageUrl: null,
    imageUrls: [],
    conditionText: payload.condition,
    listingType: payload.listingType,
    listingTypeText: formatListingType(payload.listingType),
    status,
    statusText: formatListingStatus(status),
    publicationState: normalizeListingPublicationState(
      pickString(listing, ["publicationState", "publication_state"])
    ),
    publishAfter:
      pickString(listing, ["publishAfter", "publish_after"]) ?? null,
    publishedAt:
      pickString(listing, ["publishedAt", "published_at"]) ?? null,
    publicationReviewReason:
      pickString(listing, [
        "publicationReviewReason",
        "publication_review_reason"
      ]) ?? null,
    recommendedAgeMinMonths: payload.recommendedAgeMinMonths,
    recommendedAgeMaxMonths: payload.recommendedAgeMaxMonths
  };
}

function extractCategoryArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.categories)) {
    return payload.categories;
  }

  if (isRecord(payload.data)) {
    return extractCategoryArray(payload.data);
  }

  return [];
}

function normalizeCategory(value: unknown): MobileCategory | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = pickString(value, ["id"]);
  const name = pickString(value, ["name"]);
  const slug = pickString(value, ["slug"]) ?? id;
  const parentId = pickString(value, ["parentId"]);

  if (!id || !name || !slug) {
    return null;
  }

  return {
    id,
    name,
    slug,
    parentId
  };
}

function isMobileCategory(value: MobileCategory | null): value is MobileCategory {
  return value !== null;
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

function unwrapApiData(payload: unknown): unknown {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function formatPriceObject(value: Record<string, unknown> | null): string | null {
  if (!value) {
    return null;
  }

  const amount = pickString(value, ["amount"]);
  const currency = pickString(value, ["currency"]) ?? "TRY";

  if (!amount) {
    return null;
  }

  return `${amount} ${currency === "TRY" ? "TL" : currency}`;
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


function normalizeListingPublicationState(
  value: string | null
): MobileListingPublicationState {
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

function formatListingType(value: string): string {
  switch (value) {
    case "sale":
      return "Satılık";
    case "donation":
      return "Bağış";
    case "swap":
      return "Takas";
    default:
      return "İlan tipi belirtilmedi";
  }
}

function normalizeListingStatus(value: string | null): MobileListingStatus {
  if (
    value === "draft" ||
    value === "active" ||
    value === "reserved" ||
    value === "sold" ||
    value === "archived"
  ) {
    return value;
  }

  return "active";
}

function formatListingStatus(value: MobileListingStatus): string {
  switch (value) {
    case "draft":
      return "Taslak / incelemede";
    case "active":
      return "Aktif";
    case "reserved":
      return "Rezerve";
    case "sold":
      return "Satıldı";
    case "archived":
      return "Arşivli";
    default:
      return "Taslak";
  }
}
