export type SavedSearchFilters = {
  q?: string;
  city?: string;
  categoryId?: string;
  condition?: "new" | "like_new" | "good" | "fair" | "needs_repair";
  listingType?: "sale" | "swap" | "donation";
  sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "relevance";
  priceMin?: number;
  priceMax?: number;
};

export type SavedSearchDraft = {
  name: string;
  filters: SavedSearchFilters;
};

const allowedSorts = new Set(["newest", "oldest", "price_asc", "price_desc", "relevance"]);
const allowedConditions = new Set(["new", "like_new", "good", "fair", "needs_repair"]);
const allowedListingTypes = new Set(["sale", "swap", "donation"]);

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeNumber(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export function createSavedSearchDraft(input: {
  name: string;
  q?: string;
  city?: string;
  categoryId?: string;
  condition?: string;
  listingType?: string;
  sort?: string;
  priceMin?: string;
  priceMax?: string;
}): SavedSearchDraft {
  const name = cleanText(input.name);

  if (!name) {
    throw new Error("Saved search name is required.");
  }

  const filters: SavedSearchFilters = {};

  const q = input.q ? cleanText(input.q) : "";
  const city = input.city ? cleanText(input.city) : "";
  const categoryId = input.categoryId ? cleanText(input.categoryId) : "";

  if (q) {
    filters.q = q;
  }

  if (city) {
    filters.city = city;
  }

  if (categoryId) {
    filters.categoryId = categoryId;
  }

  if (input.condition && allowedConditions.has(input.condition)) {
    filters.condition = input.condition as NonNullable<SavedSearchFilters["condition"]>;
  }

  if (input.listingType && allowedListingTypes.has(input.listingType)) {
    filters.listingType = input.listingType as NonNullable<SavedSearchFilters["listingType"]>;
  }

  if (input.sort && allowedSorts.has(input.sort)) {
    filters.sort = input.sort as NonNullable<SavedSearchFilters["sort"]>;
  }

  const priceMin = input.priceMin ? normalizeNumber(input.priceMin) : undefined;
  const priceMax = input.priceMax ? normalizeNumber(input.priceMax) : undefined;

  if (priceMin !== undefined) {
    filters.priceMin = priceMin;
  }

  if (priceMax !== undefined) {
    filters.priceMax = priceMax;
  }

  return {
    name,
    filters
  };
}
