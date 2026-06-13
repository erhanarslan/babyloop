export type AdminProductAnalyticsEventName =
  | "listing_detail_viewed"
  | "listing_card_clicked"
  | "listing_recommendation_impression"
  | "contact_seller_intent"
  | "recently_viewed_listing_clicked"
  | "category_viewed"
  | "search_performed";

export type AdminProductAnalyticsEventCountResponse = {
  eventType: AdminProductAnalyticsEventName;
  count: number;
};

export type AdminProductAnalyticsSourceCountResponse = {
  source: string;
  count: number;
};

export type AdminProductAnalyticsTopCategoryResponse = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  viewCount: number;
};

export type AdminProductAnalyticsTopListingResponse = {
  listingId: string;
  title: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  eventCount: number;
};

export type AdminProductAnalyticsSearchBucketResponse = {
  resultBucket: string;
  count: number;
};

export type AdminProductAnalyticsSummaryResponse = {
  totals: {
    totalEvents: number;
    eventsLast24Hours: number;
    eventsLast7Days: number;
    listingDetailViewsLast7Days: number;
    listingCardClicksLast7Days: number;
    recommendationImpressionsLast7Days: number;
    recommendationClicksLast7Days: number;
    contactSellerIntentsLast7Days: number;
    recommendationClickRateLast7Days: number;
    detailToContactIntentRateLast7Days: number;
    categoryViewsLast7Days: number;
    searchesLast7Days: number;
    recentlyViewedClicksLast7Days: number;
  };
  eventCounts: AdminProductAnalyticsEventCountResponse[];
  sourceCounts: AdminProductAnalyticsSourceCountResponse[];
  topCategories: AdminProductAnalyticsTopCategoryResponse[];
  topListings: AdminProductAnalyticsTopListingResponse[];
  searchResultBuckets: AdminProductAnalyticsSearchBucketResponse[];
};
