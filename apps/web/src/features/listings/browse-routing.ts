import type { BrowseListingsFilters } from "../../lib/api";
import { normalizeLocationPreference } from "../../components/navigation/location-preference-model";
import { getLocationQueryValue } from "../../components/navigation/public-navigation-model";

export const DEFAULT_LISTINGS_LIMIT = 20;

export type BrowseSearchParams = Record<string, string | string[] | undefined> | undefined;

export function resolveBrowseFilters(
  searchParams: BrowseSearchParams,
  overrides: Partial<BrowseListingsFilters> = {}
): BrowseListingsFilters {
  const offset = parsePositiveInteger(readParam(searchParams?.offset), 0);
  return {
    q: readParam(searchParams?.q).trim(),
    city: readParam(searchParams?.city).trim(),
    categoryId: readParam(searchParams?.categoryId),
    condition: readParam(searchParams?.condition),
    listingType: readParam(searchParams?.listingType),
    priceMin: readParam(searchParams?.priceMin),
    priceMax: readParam(searchParams?.priceMax),
    hasImages: readBooleanParam(searchParams?.hasImages, "true"),
    sort: readParam(searchParams?.sort) || "newest",
    limit: DEFAULT_LISTINGS_LIMIT,
    offset: Math.min(Math.max(offset, 0), 10000),
    ...overrides
  };
}

export function resolveBrowseLocationCity(
  searchParams: BrowseSearchParams,
  storedLocation: string | null | undefined
): string {
  if (searchParams && Object.prototype.hasOwnProperty.call(searchParams, "city")) {
    return readParam(searchParams.city).trim();
  }

  return getLocationQueryValue(normalizeLocationPreference(storedLocation));
}

export function buildListingsPath(filters: BrowseListingsFilters): string {
  const params = new URLSearchParams();

  appendIfPresent(params, "q", filters.q);
  appendIfPresent(params, "city", filters.city);
  appendIfPresent(params, "categoryId", filters.categoryId);
  appendIfPresent(params, "condition", filters.condition);
  appendIfPresent(params, "listingType", filters.listingType);
  appendIfPresent(params, "priceMin", filters.priceMin);
  appendIfPresent(params, "priceMax", filters.priceMax);
  appendIfPresent(params, "hasImages", filters.hasImages);
  appendIfPresent(params, "sort", filters.sort);
  params.set("imageLimit", "3");
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));

  return `/api/v1/listings?${params.toString()}`;
}

export function appendIfPresent(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
}

function readBooleanParam(value: string | string[] | undefined, fallback = ""): string {
  const normalized = readParam(value);

  if (normalized === "true") {
    return "true";
  }

  if (normalized === "false") {
    return "";
  }

  return fallback;
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}
