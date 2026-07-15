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

    if (hasUnsafeComposerPattern(trimmedBody) || !moderateMessageBody(trimmedBody).allowed) {
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

  const showGuidance = composerGuidance?.tone === "warning";

  return (
    <form className="message-composer-p0" onSubmit={handleSubmit}>
      <Textarea
        label="Mesaj"
        maxLength={500}
        rows={2}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Durum, teslim veya ek fotoğraf sor..."
      />

      {showGuidance && composerGuidance ? (
        <div className="message-composer-p0-warning">
          {composerGuidance.message}
        </div>
      ) : null}

      <div className="message-composer-p0-footer">
        {errorMessage ? (
          <Alert title="Mesaj gönderilemedi" message={errorMessage} />
        ) : null}
        <Button disabled={isPending || body.trim().length === 0} type="submit">
          {isPending ? "Gönderiliyor" : "Gönder"}
        </Button>
      </div>
    </form>
  );
}

function hasUnsafeComposerPattern(value: string): boolean {
  return /[<>]/.test(value) || /script/i.test(value);
}

function buildComposerGuidance(value: string): { tone: "info" | "warning"; message: string } | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (hasUnsafeComposerPattern(normalized)) {
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

  if (normalized.length > 400) {
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
