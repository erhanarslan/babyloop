import { marketplaceJson } from "../marketplace/api-client";
import type { SavedSearchDraft, SavedSearchFilters } from "./saved-searches-model";

export type SavedSearch = {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  createdAt?: string;
  updatedAt?: string;
  notificationEnabled?: boolean;
};

type SavedSearchListResponse = {
  savedSearches?: unknown[];
  items?: unknown[];
};

export function normalizeSavedSearchListPayload(payload: unknown): SavedSearch[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeSavedSearchPayload).filter(isSavedSearch);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const items = Array.isArray(payload.savedSearches)
    ? payload.savedSearches
    : Array.isArray(payload.items)
      ? payload.items
      : [];

  return items.map(normalizeSavedSearchPayload).filter(isSavedSearch);
}

export function normalizeSavedSearchPayload(payload: unknown): SavedSearch | null {
  if (!isRecord(payload)) {
    return null;
  }

  const id = readText(payload.id);
  const name = readText(payload.name);

  if (!id || !name) {
    return null;
  }

  const nestedFilters = isRecord(payload.filters) ? payload.filters : {};
  const filters: SavedSearchFilters = {};

  assignText(filters, "q", nestedFilters.q ?? payload.q);
  assignText(filters, "city", nestedFilters.city ?? payload.city);
  assignText(filters, "categoryId", nestedFilters.categoryId ?? payload.categoryId);
  assignCondition(filters, nestedFilters.condition ?? payload.condition);
  assignListingType(filters, nestedFilters.listingType ?? payload.listingType);
  assignSort(filters, nestedFilters.sort ?? payload.sort);
  assignNumber(filters, "priceMin", nestedFilters.priceMin ?? payload.priceMin);
  assignNumber(filters, "priceMax", nestedFilters.priceMax ?? payload.priceMax);

  const createdAt = readText(payload.createdAt);
  const updatedAt = readText(payload.updatedAt);
  const notificationEnabled =
    readBoolean(payload.notificationEnabled) ??
    readBoolean(payload.notificationsEnabled);

  return {
    id,
    name,
    filters,
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(notificationEnabled !== undefined ? { notificationEnabled } : {})
  };
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const payload = await marketplaceJson<SavedSearchListResponse | unknown[]>(
    "/api/v1/saved-searches"
  );

  return normalizeSavedSearchListPayload(payload);
}

export async function createSavedSearch(draft: SavedSearchDraft): Promise<SavedSearch> {
  const payload = await marketplaceJson<
    { savedSearch?: unknown; item?: unknown } | unknown
  >("/api/v1/saved-searches", {
    method: "POST",
    body: JSON.stringify(draft)
  });

  const candidate =
    isRecord(payload) && !("id" in payload)
      ? payload.savedSearch ?? payload.item
      : payload;
  const savedSearch = normalizeSavedSearchPayload(candidate);

  if (!savedSearch) {
    throw new Error("Saved search response is invalid.");
  }

  return savedSearch;
}

export async function deleteSavedSearch(savedSearchId: string): Promise<void> {
  await marketplaceJson(`/api/v1/saved-searches/${encodeURIComponent(savedSearchId)}`, {
    method: "DELETE"
  });
}

function isSavedSearch(value: SavedSearch | null): value is SavedSearch {
  return value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function assignText(
  filters: SavedSearchFilters,
  key: "q" | "city" | "categoryId",
  value: unknown
): void {
  const normalized = readText(value);

  if (normalized) {
    filters[key] = normalized;
  }
}

function assignNumber(
  filters: SavedSearchFilters,
  key: "priceMin" | "priceMax",
  value: unknown
): void {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (Number.isFinite(numberValue) && numberValue >= 0) {
    filters[key] = numberValue;
  }
}

function assignCondition(filters: SavedSearchFilters, value: unknown): void {
  if (
    value === "new" ||
    value === "like_new" ||
    value === "good" ||
    value === "fair" ||
    value === "needs_repair"
  ) {
    filters.condition = value;
  }
}

function assignListingType(filters: SavedSearchFilters, value: unknown): void {
  if (value === "sale" || value === "swap" || value === "donation") {
    filters.listingType = value;
  }
}

function assignSort(filters: SavedSearchFilters, value: unknown): void {
  if (
    value === "newest" ||
    value === "oldest" ||
    value === "price_asc" ||
    value === "price_desc" ||
    value === "relevance"
  ) {
    filters.sort = value;
  }
}
