"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Button,
  PageContainer,
  Textarea
} from "../../components/ui";
import {
  requestAssistantMessage,
  type AssistantMessageAction
} from "./api";
import styles from "./assistant-page-content.module.css";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  actions?: AssistantMessageAction[];
};

type AssistantPageContentProps = {
  apiBaseUrl: string;
};

export function AssistantPageContent({ apiBaseUrl }: AssistantPageContentProps) {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt")?.trim();

    if (prompt) {
      setInputValue(prompt.slice(0, 1000));
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedInput = inputValue.trim();

    if (!normalizedInput || isPending) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: normalizedInput
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInputValue("");
    setIsPending(true);
    setErrorMessage(null);

    const response = await requestAssistantMessage(apiBaseUrl, {
      locale: "tr",
      message: normalizedInput
    });

    if (response.ok) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.data.answer,
          actions: response.data.actions ?? []
        }
      ]);
      setIsPending(false);
      return;
    }

    setErrorMessage("Asistan şu an yapılandırılmadı. Daha sonra tekrar deneyebilirsin.");
    setIsPending(false);
  }

  return (
    <PageContainer className={styles.layout ?? ""} ariaLabel="BabyLoop Asistan">
      <header className={styles.heading}>
        <h1>BabyLoop Asistan</h1>
        <p>Ürün, ilan ve ebeveynlik sorularını kısa şekilde sorabilirsin.</p>
      </header>

      <section className={styles.card} aria-label="Sorunu yaz">
        <form className={styles.composer} onSubmit={handleSubmit}>
          <Textarea
            label="Sorunu yaz"
            maxLength={1000}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Örn. 12 aylık bebeğim için dışarı çıkarken nelere dikkat etmeliyim?"
            rows={4}
            value={inputValue}
            wide
          />
          <div className={styles.actions}>
            <span>{inputValue.length}/1000</span>
            <Button type="submit" disabled={isPending || inputValue.trim().length === 0}>
              {isPending ? "Yanıt hazırlanıyor..." : "Sor"}
            </Button>
          </div>
        </form>

        {errorMessage ? (
          <Alert title="Asistan kullanılamıyor" message={errorMessage} />
        ) : null}

        <div className={styles.answerArea} aria-live="polite">
          {messages.length === 0 && !isPending ? (
            <div className={styles.empty}>
              Sorunu yaz, kısa ve anlaşılır bir yanıt hazırlayalım.
            </div>
          ) : null}

          {messages.map((message) => (
            <AssistantMessageCard key={message.id} message={message} />
          ))}

          {isPending ? (
            <article className={`${styles.message} ${styles.assistant}`}>
              <strong>Yanıt hazırlanıyor...</strong>
            </article>
          ) : null}
        </div>
      </section>
    </PageContainer>
  );
}

function AssistantMessageCard({ message }: { message: AssistantMessage }) {
  const roleClassName = message.role === "assistant" ? styles.assistant : styles.user;

  return (
    <article className={`${styles.message} ${roleClassName}`}>
      <strong>{message.role === "assistant" ? "Yanıt" : "Sen"}</strong>
      <p>{message.content}</p>

      {message.actions && message.actions.length > 0 ? (
        <div className={styles.actionRow}>
          {message.actions.map((action) => (
            <Link href={action.href} key={`${action.href}-${action.label}`}>
              {localizeActionLabel(action.label, action.href)}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function localizeActionLabel(label: string, href: string): string {
  const normalizedLabel = normalizeText(label);

  if (href.startsWith("/browse") || normalizedLabel.includes("listing")) {
    return "İlanlara bak";
  }

  if (href.startsWith("/guides") || normalizedLabel.includes("guide")) {
    return "Ebeveyn rehberi";
  }

  if (href.startsWith("/account/children") || normalizedLabel.includes("child")) {
    return "Çocuğum";
  }

  if (href.startsWith("/sell") || normalizedLabel.includes("sell")) {
    return "İlan oluştur";
  }

  if (href.startsWith("/account/saved-searches") || normalizedLabel.includes("saved")) {
    return "Kayıtlı aramalar";
  }

  return "Aç";
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}
