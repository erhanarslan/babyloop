"use client";

import { useEffect, useState } from "react";
import { CART_CHANGED_EVENT, fetchCartSummary } from "./api";

export function useHeaderCartSummary(
  apiBaseUrl: string,
  authenticatedUserId: string | null
): number {
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    if (!authenticatedUserId) {
      setCartItemCount(0);
      return;
    }

    let isActive = true;

    async function loadCartCount() {
      try {
        const body = await fetchCartSummary(apiBaseUrl);

        if (!isActive) {
          return;
        }

        setCartItemCount(body.ok ? body.data.summary.itemCount : 0);
      } catch {
        if (isActive) {
          setCartItemCount(0);
        }
      }
    }

    void loadCartCount();
    window.addEventListener(CART_CHANGED_EVENT, loadCartCount);

    return () => {
      isActive = false;
      window.removeEventListener(CART_CHANGED_EVENT, loadCartCount);
    };
  }, [apiBaseUrl, authenticatedUserId]);

  return cartItemCount;
}
