"use client";

import type { ApiResponse } from "@babyloop/shared";
import { authFetch } from "../../lib/auth-client";
import type { ListingSummary } from "../../lib/api";

export const CART_CHANGED_EVENT = "babyloop-cart-changed";

export type CartListing = Omit<ListingSummary, "favoriteCount" | "createdAt">;

export type CartItem = {
  id: string;
  listing: CartListing;
  createdAt: string;
};

export type CartPayload = {
  cart: {
    items: CartItem[];
    unavailableItems: CartItem[];
    subtotal: {
      amount: string;
      currency: "TRY";
    };
    currency: "TRY";
  };
};

export type MockCheckoutPayload = {
  checkout: {
    orderId: string;
    paymentId: string;
    mockIyzicoPaymentId: string;
    status: "paid";
    paidAmount: string;
    currency: "TRY";
    items: Array<{
      listingId: string;
      title: string;
      price: ListingSummary["price"];
      listingType: string;
    }>;
  };
};

export async function fetchCart(apiBaseUrl: string): Promise<ApiResponse<CartPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/cart");

  return response.json() as Promise<ApiResponse<CartPayload>>;
}

export async function addCartItem(apiBaseUrl: string, listingId: string): Promise<ApiResponse<CartPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/cart/items", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ listingId })
  });
  const body = await response.json() as ApiResponse<CartPayload>;

  if (body.ok) {
    dispatchCartChanged();
  }

  return body;
}

export async function removeCartItem(apiBaseUrl: string, listingId: string): Promise<ApiResponse<CartPayload>> {
  const response = await authFetch(apiBaseUrl, `/api/v1/cart/items/${listingId}`, {
    method: "DELETE"
  });
  const body = await response.json() as ApiResponse<CartPayload>;

  if (body.ok) {
    dispatchCartChanged();
  }

  return body;
}

export async function clearCart(apiBaseUrl: string): Promise<ApiResponse<CartPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/cart", {
    method: "DELETE"
  });
  const body = await response.json() as ApiResponse<CartPayload>;

  if (body.ok) {
    dispatchCartChanged();
  }

  return body;
}

export async function checkoutWithMockIyzico(
  apiBaseUrl: string,
  scenario: "success" | "failure" = "success"
): Promise<ApiResponse<MockCheckoutPayload>> {
  const response = await authFetch(apiBaseUrl, "/api/v1/checkout/mock-iyzico", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ scenario })
  });
  const body = await response.json() as ApiResponse<MockCheckoutPayload>;

  if (body.ok) {
    dispatchCartChanged();
  }

  return body;
}

function dispatchCartChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}
