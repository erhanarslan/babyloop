"use client";

import { moderateMessageBody } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, Textarea } from "../../components/ui";
import { sendMessage, type Message } from "./api";

type MessageComposerProps = {
  apiBaseUrl: string;
  conversationId: string;
  onSent: (message: Message) => void;
};

export function MessageComposer({ apiBaseUrl, conversationId, onSent }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const composerGuidance = buildComposerGuidance(body);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setErrorMessage("Mesaj boş olamaz.");
      return;
    }

    if (!moderateMessageBody(trimmedBody).allowed) {
      setErrorMessage("Bu mesaj güvenli görünmüyor. Lütfen özel bilgi veya kod benzeri içerik olmadan tekrar yaz.");
      return;
    }

    setErrorMessage(null);
    setIsPending(true);

    try {
      const response = await sendMessage(apiBaseUrl, conversationId, trimmedBody);

      if (!response.ok) {
        setErrorMessage("Mesaj gönderilemedi. Biraz sonra tekrar dene.");
        return;
      }

      setBody("");
      onSent(response.data.message);
    } catch {
      setErrorMessage("Mesaj gönderilemedi. Biraz sonra tekrar dene.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-3 border-t border-border bg-background p-3 sm:p-4" onSubmit={handleSubmit}>
      <Textarea
        label="Mesaj"
        maxLength={5000}
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Mesaj yaz..."
      />
      {composerGuidance ? (
        <div
          className={[
            "rounded-2xl px-3 py-2 text-xs font-semibold leading-5",
            composerGuidance.tone === "warning"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              : "bg-muted text-muted-foreground"
          ].join(" ")}
        >
          {composerGuidance.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
        <p>Konuşmayı BabyLoop içinde tut.</p>
        <span>{body.length}/5000</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {errorMessage ? (
          <Alert title="Mesaj gönderilemedi" message={errorMessage} />
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">Yalnızca konuşmadaki kişiler görebilir.</p>
        )}
        <Button disabled={isPending || body.trim().length === 0} type="submit">
          {isPending ? "Gönderiliyor" : "Gönder"}
        </Button>
      </div>
    </form>
  );
}

function buildComposerGuidance(value: string): { tone: "info" | "warning"; message: string } | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (/[<>]/.test(normalized) || /script/i.test(normalized)) {
    return {
      tone: "warning",
      message: "Kod benzeri metni çıkarıp ürüne odaklı kısa bir mesaj yaz."
    };
  }

  if (/\b(phone|telefon|whatsapp|iban|password|şifre|sifre|card number|credit card)\b/i.test(normalized)) {
    return {
      tone: "warning",
      message: "Telefon, ödeme veya şifre gibi özel bilgileri paylaşmamaya dikkat et."
    };
  }

  if (normalized.length > 1200) {
    return {
      tone: "warning",
      message: "Mesaj uzuyor. Kısa ve net sorulara daha hızlı yanıt gelir."
    };
  }

  if (normalized.length > 0 && normalized.length < 20) {
    return {
      tone: "info",
      message: "Biraz daha detay ekleyebilirsin: durum, eksik parça veya teslim zamanı gibi."
    };
  }

  return null;
}
