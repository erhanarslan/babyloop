"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  PageContainer,
  Textarea
} from "../../components/ui";
import {
  requestAssistantMessage
} from "./api";
import {
  normalizeWebAssistantResponse,
  type WebAssistantResponse
} from "./assistant-response-model";
import styles from "./assistant-page-content.module.css";
import { useAnalytics } from "../analytics/use-analytics";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  response?: WebAssistantResponse;
};

type AssistantPageContentProps = {
  apiBaseUrl: string;
};

export function AssistantPageContent({ apiBaseUrl }: AssistantPageContentProps) {
  const analytics = useAnalytics();
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    analytics.trackAssistantOpened();
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt")?.trim();

    if (prompt) {
      setInputValue(prompt);
    }
  }, [analytics]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitPrompt(inputValue);
  }

  async function submitPrompt(value: string) {
    const normalizedInput = value.trim();

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
    setLastFailedPrompt(null);
    analytics.track({
      eventName: "assistant_question_submitted",
      properties: { domain: "general", sourceSurface: "assistant" }
    });
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const response = await requestAssistantMessage(apiBaseUrl, {
      locale: "tr",
      message: normalizedInput
    });

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (response.ok) {
      let normalizedResponse: WebAssistantResponse;

      try {
        normalizedResponse = normalizeWebAssistantResponse(response.data);
      } catch {
        analytics.track({
          eventName: "assistant_error",
          properties: { reasonBucket: "invalid_response", sourceSurface: "assistant" }
        });
        setLastFailedPrompt(normalizedInput);
        setErrorMessage("Asistan yanıtı okunamadı. Tekrar deneyebilirsin.");
        setIsPending(false);
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: normalizedResponse.answer,
          response: normalizedResponse
        }
      ]);
      analytics.trackAssistantAnswer({
        grounded: normalizedResponse.grounded,
        mode: normalizedResponse.mode,
        sourceCount: normalizedResponse.sourceCards.length
      });
      setIsPending(false);
      return;
    }

    setLastFailedPrompt(normalizedInput);
    analytics.track({
      eventName: "assistant_error",
      properties: { reasonBucket: response.error.code, sourceSurface: "assistant" }
    });
    setErrorMessage(getAssistantErrorMessage(response.error.code));
    setIsPending(false);
  }

  return (
    <PageContainer className={styles.layout ?? ""} ariaLabel="BabyLoop Asistan">
      <header className={styles.heading}>
        <h1 className={styles.assistantTitle}>
          <img
            alt="BabyLoop"
            className={styles.brandLogo}
            src="/brand/home/babyloop-logo-full-transparent.png"
          />
          <span>Asistan</span>
        </h1>
        <p>Ürün, ilan ve ebeveynlik sorularını kısa şekilde sorabilirsin.</p>
      </header>

      <section className={styles.card} aria-label="Sorunu yaz">
        <form className={styles.composer} onSubmit={handleSubmit}>
          <div
            className={styles.composerInputWrap}
            data-testid="assistant-composer-input-wrap"
          >
            <Textarea
              className={styles.promptInput}
              label="Sorunu yaz"
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Örn. 12 aylık bebeğim için dışarı çıkarken nelere dikkat etmeliyim?"
              rows={4}
              value={inputValue}
              wide
            />
            <Button
              aria-label={isPending ? "Yanıt hazırlanıyor" : "Sor"}
              className={styles.submitButton}
              type="submit"
              disabled={isPending || inputValue.trim().length === 0}
            >
              {isPending ? (
                <span className={styles.pendingLabel}>
                  <span aria-hidden="true" className={styles.spinner} />
                  Hazırlanıyor
                </span>
              ) : "Sor"}
            </Button>
          </div>
        </form>

        {errorMessage ? (
          <div className={styles.retryBlock}>
            <Alert title="Asistan kullanılamıyor" message={errorMessage} />
            {lastFailedPrompt ? (
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => void submitPrompt(lastFailedPrompt)}>
                Tekrar dene
              </Button>
            ) : null}
          </div>
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

      {message.response ? (
        <div className={styles.modeRow}>
          <span>{message.response.modeLabel}</span>
          {message.response.showGrounded ? (
            <span>{message.response.grounded ? "Kaynaklarla destekli" : "Genel yönlendirme"}</span>
          ) : null}
        </div>
      ) : null}

      {message.response?.toolPreviewCards.length ? (
        <div className={styles.toolPreview} aria-label="Araç sonuçları">
          {message.response.toolPreviewCards.map((preview) => (
            <div key={preview.id}>
              <strong>{preview.title}</strong>
              <span>{preview.summary}</span>
            </div>
          ))}
        </div>
      ) : null}

      {message.response?.actionCards.length ? (
        <div className={styles.actionRow}>
          {message.response.actionCards.map((action) => (
            action.href ? (
              <Link href={action.href} key={action.id}>
                {localizeActionLabel(action.label, action.href)}
              </Link>
            ) : (
              <span key={action.id}>{action.label}</span>
            )
          ))}
        </div>
      ) : null}

      {message.response?.sourceCards.length ? (
        <div className={styles.sources} aria-label="Kaynaklar">
          <span>Kaynaklar</span>
          <ul>
            {message.response.sourceCards.map((source) => (
              <li key={source.id}>
                {source.label}
                {source.topic ? ` · ${source.topic}` : ""}
                {source.reliability ? ` · ${source.reliability}` : ""}
              </li>
            ))}
          </ul>
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


function getAssistantErrorMessage(code: string): string {
  if (code === "RAG_USAGE_LIMIT_EXCEEDED") {
    return "Asistan kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyebilirsin.";
  }

  if (code === "ASSISTANT_UNAVAILABLE" || code === "API_UNAVAILABLE") {
    return "Asistan şu an hazırlanamadı. Daha sonra tekrar deneyebilirsin.";
  }

  if (code === "UNAUTHORIZED") {
    return "Asistanı kullanmak için giriş yapman gerekiyor.";
  }

  return "Asistan yanıtı alınamadı. Tekrar deneyebilirsin.";
}
