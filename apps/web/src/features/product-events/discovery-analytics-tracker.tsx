"use client";

import { useEffect } from "react";
import { recordProductEvent, type ProductEventSource } from "./api";

type DiscoveryAnalyticsTrackerProps = {
  apiBaseUrl: string;
  categoryId: string;
  resultCount: number;
  searchQuery: string;
  source: Extract<ProductEventSource, "browse" | "category_landing">;
};

export function DiscoveryAnalyticsTracker({
  apiBaseUrl,
  categoryId,
  resultCount,
  searchQuery,
  source
}: DiscoveryAnalyticsTrackerProps) {
  useEffect(() => {
    if (categoryId) {
      void recordProductEvent(apiBaseUrl, {
        categoryId,
        eventType: "category_viewed",
        source
      });
    }
  }, [apiBaseUrl, categoryId, source]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 3) {
      return;
    }

    void recordProductEvent(apiBaseUrl, {
      ...(categoryId ? { categoryId } : {}),
      eventType: "search_performed",
      queryLength: Math.min(normalizedQuery.length, 80),
      resultCount: Math.min(Math.max(resultCount, 0), 10000),
      source
    });
  }, [apiBaseUrl, categoryId, resultCount, searchQuery, source]);

  return null;
}
