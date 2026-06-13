"use client";

export type ListingProductEventType =
  | "listing_detail_viewed"
  | "listing_card_clicked"
  | "contact_seller_intent"
  | "recently_viewed_listing_clicked";

export type ProductEventType =
  | ListingProductEventType
  | "category_viewed"
  | "search_performed";

export type ProductEventSource =
  | "home"
  | "browse"
  | "category_landing"
  | "listing_detail"
  | "favorites"
  | "recommendation"
  | "recently_viewed";

export type ProductEventPayload =
  | {
      eventType: ListingProductEventType;
      listingId: string;
      categoryId?: string;
      source?: ProductEventSource;
    }
  | {
      eventType: "category_viewed";
      categoryId: string;
      source?: ProductEventSource;
    }
  | {
      eventType: "search_performed";
      queryLength: number;
      resultCount?: number;
      categoryId?: string;
      source?: ProductEventSource;
    };

export async function recordProductEvent(
  apiBaseUrl: string,
  payload: ProductEventPayload
): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/api/v1/product-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      credentials: "include",
      keepalive: true
    });
  } catch {
    // Product analytics must never block the user-facing marketplace flow.
  }
}
