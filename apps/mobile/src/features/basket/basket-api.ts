import { resolveApiAssetUrl, safeApiErrorMessage } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import {
  normalizeCart,
  normalizeCheckout,
  type MobileCart,
  type MobileMockCheckout
} from "./basket-model";

export type { MobileCart, MobileCartItem, MobileMockCheckout } from "./basket-model";

export async function fetchMobileCart(): Promise<MobileCart> {
  const response = await mobileAuthFetch("/api/v1/cart");
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "Sepet şu an yüklenemedi."));
  }

  return normalizeCart(payload, resolveApiAssetUrl);
}

export async function addMobileCartItem(listingId: string): Promise<MobileCart> {
  const response = await mobileAuthFetch("/api/v1/cart/items", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ listingId })
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "İlan sepete eklenemedi."));
  }

  return normalizeCart(payload, resolveApiAssetUrl);
}

export async function removeMobileCartItem(listingId: string): Promise<MobileCart> {
  const response = await mobileAuthFetch(`/api/v1/cart/items/${encodeURIComponent(listingId)}`, {
    method: "DELETE"
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "İlan sepetten kaldırılamadı."));
  }

  return normalizeCart(payload, resolveApiAssetUrl);
}

export async function clearMobileCart(): Promise<MobileCart> {
  const response = await mobileAuthFetch("/api/v1/cart", {
    method: "DELETE"
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "Sepet temizlenemedi."));
  }

  return normalizeCart(payload, resolveApiAssetUrl);
}

export async function checkoutMobileMockIyzico(): Promise<MobileMockCheckout> {
  const response = await mobileAuthFetch("/api/v1/checkout/mock-iyzico", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ scenario: "success" })
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(safeApiErrorMessage(payload, "Demo checkout tamamlanamadı. Sepet değişmedi."));
  }

  return normalizeCheckout(payload);
}
