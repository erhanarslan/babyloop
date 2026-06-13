"use client";

export type ProductEventType =
  | "listing_detail_viewed"
  | "listing_card_clicked"
  | "contact_seller_intent";

export type ProductEventSource =
  | "home"
  | "browse"
  | "listing_detail"
  | "favorites"
  | "recommendation";

export type ProductEventPayload = {
  eventType: ProductEventType;
  listingId: string;
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
