"use client";

import { useEffect } from "react";
import type { ListingSummary } from "../../lib/api";
import { saveRecentlyViewedListing } from "./recently-viewed-storage";

export function RecentlyViewedTracker({ listing }: { listing: ListingSummary }) {
  useEffect(() => {
    saveRecentlyViewedListing(listing);
  }, [listing]);

  return null;
}
