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
  savedSearches?: SavedSearch[];
  items?: SavedSearch[];
};

function normalizeSavedSearchList(data: SavedSearchListResponse | SavedSearch[]): SavedSearch[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data.savedSearches ?? data.items ?? [];
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  return normalizeSavedSearchList(await marketplaceJson<SavedSearchListResponse | SavedSearch[]>("/api/v1/saved-searches"));
}

export async function createSavedSearch(draft: SavedSearchDraft): Promise<SavedSearch> {
  const data = await marketplaceJson<{ savedSearch?: SavedSearch; item?: SavedSearch } | SavedSearch>(
    "/api/v1/saved-searches",
    {
      method: "POST",
      body: JSON.stringify(draft)
    }
  );

  if ("id" in data) {
    return data;
  }

  const savedSearch = data.savedSearch ?? data.item;

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
