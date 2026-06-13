import type { BrowseListingsFilters } from "../../lib/api";

export const DEFAULT_LISTINGS_LIMIT = 20;

export type BrowseSearchParams = Record<string, string | string[] | undefined> | undefined;

export function resolveBrowseFilters(
  searchParams: BrowseSearchParams,
  overrides: Partial<BrowseListingsFilters> = {}
): BrowseListingsFilters {
  const offset = parsePositiveInteger(readParam(searchParams?.offset), 0);
  const limit = parsePositiveInteger(readParam(searchParams?.limit), DEFAULT_LISTINGS_LIMIT);

  return {
    q: readParam(searchParams?.q).trim(),
    categoryId: readParam(searchParams?.categoryId),
    condition: readParam(searchParams?.condition),
    listingType: readParam(searchParams?.listingType),
    sort: readParam(searchParams?.sort) || "newest",
    limit: Math.min(Math.max(limit, 1), 50),
    offset: Math.min(Math.max(offset, 0), 10000),
    ...overrides
  };
}

export function buildListingsPath(filters: BrowseListingsFilters): string {
  const params = new URLSearchParams();

  appendIfPresent(params, "q", filters.q);
  appendIfPresent(params, "categoryId", filters.categoryId);
  appendIfPresent(params, "condition", filters.condition);
  appendIfPresent(params, "listingType", filters.listingType);
  appendIfPresent(params, "sort", filters.sort);
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));

  return `/api/v1/listings?${params.toString()}`;
}

export function appendIfPresent(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value.trim());
  }
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
