import { cache } from "react";
import { fetchApi, type CategoriesPayload } from "../../lib/api";

export const fetchBrowseCategories = cache(async () =>
  fetchApi<CategoriesPayload>("/api/v1/categories")
);
