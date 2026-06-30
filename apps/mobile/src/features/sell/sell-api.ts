import { apiGet, isRecord, safeApiErrorMessage } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import type { MobileListingSummary } from "../listings/listings-api";
import type { MobileCreateListingPayload } from "./sell-form-model";

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

  if (!id) {
    throw new Error("İlan oluşturuldu ancak ilan id bilgisi alınamadı.");
  }

  return {
    id,
    title,
    priceText,
    locationText: "Konum belirtilmedi",
    imageUrl: null,
    conditionText: payload.condition
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
