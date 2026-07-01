"use client";

import { useState } from "react";
import { Button } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useAuthPrompt } from "../auth/auth-prompt-provider";
import { addCartItem } from "./api";

type AddToCartButtonProps = {
  apiBaseUrl: string;
  isAuthenticated: boolean;
  listingId: string;
};

export function AddToCartButton({
  apiBaseUrl,
  isAuthenticated,
  listingId
}: AddToCartButtonProps) {
  const { dictionary } = useI18n();
  const { openAuthPrompt } = useAuthPrompt();
  const [status, setStatus] = useState<"idle" | "pending" | "added" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleAddToCart() {
    if (!isAuthenticated) {
      openAuthPrompt({ title: dictionary.auth.loginTitle });
      return;
    }

    setStatus("pending");
    setMessage(null);

    try {
      const body = await addCartItem(apiBaseUrl, listingId);

      if (!body.ok) {
        setStatus("error");
        setMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      setStatus("added");
      setMessage("İlan sepete eklendi.");
    } catch {
      setStatus("error");
      setMessage("Sepete ekleme işlemi tamamlanamadı.");
    }
  }

  return (
    <div className="grid gap-2">
      <Button disabled={status === "pending"} type="button" onClick={() => void handleAddToCart()}>
        {status === "pending" ? "Sepete ekleniyor..." : status === "added" ? "Sepete eklendi" : "Sepete ekle"}
      </Button>
      {message ? (
        <p className={status === "error" ? "text-sm font-bold text-destructive" : "text-sm font-bold text-primary"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
