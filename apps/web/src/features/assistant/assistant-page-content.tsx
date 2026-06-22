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
  type AssistantMessageAction,
  type AssistantMessageSource,
  type AssistantSuggestedAction
} from "./api";
import styles from "./assistant-page-content.module.css";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  actions?: AssistantMessageAction[];
  sources?: AssistantMessageSource[];
  suggestedActions?: AssistantSuggestedAction[];
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
          actions: response.data.actions ?? [],
          sources: response.data.sources ?? [],
          suggestedActions: response.data.suggestedActions ?? []
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

      <AssistantSuggestedActions actions={message.suggestedActions} />

      {message.actions && message.actions.length > 0 ? (
        <div className={styles.actionRow}>
          {message.actions.map((action) => (
            <Link href={action.href} key={`${action.href}-${action.label}`}>
              {localizeActionLabel(action.label, action.href)}
            </Link>
          ))}
        </div>
      ) : null}

      {message.sources && message.sources.length > 0 ? (
        <div className={styles.sources} aria-label="Kaynaklar">
          <span>Kaynaklar</span>
          <ul>
            {message.sources.map((source) => (
              <li key={`${source.sourcePath}-${source.section ?? source.title}`}>
                {source.title}
                {source.section ? ` · ${source.section}` : ""}
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


function AssistantSuggestedActions({ actions }: { actions: AssistantSuggestedAction[] | undefined }) {
  if (!actions?.length) {
    return null;
  }

  return (
    <div className={styles["assistant-suggested-actions"]} aria-label="Önerilen aksiyonlar">
      {actions.map((action, index) => (
        <AssistantSuggestedActionCard action={action} key={`${action.type}-${action.label}-${index}`} />
      ))}
    </div>
  );
}

function AssistantSuggestedActionCard({ action }: { action: AssistantSuggestedAction }) {
  if (action.href) {
    return (
      <a className={styles["assistant-suggested-action-card"]} href={action.href}>
        <strong>{action.label}</strong>
        <span>{describeSuggestedAction(action)}</span>
      </a>
    );
  }

  if (action.type === "copy_questions") {
    const questions = extractStringArray(action.payload, "questions");

    return (
      <button
        className={styles["assistant-suggested-action-card"]}
        type="button"
        onClick={() => {
          if (questions.length > 0) {
            void navigator.clipboard?.writeText(questions.join("\n"));
          }
        }}
      >
        <strong>{action.label}</strong>
        <span>{questions.length > 0 ? `${questions.length} soru kopyalanabilir.` : describeSuggestedAction(action)}</span>
      </button>
    );
  }

  return (
    <div className={styles["assistant-suggested-action-card"]}>
      <strong>{action.label}</strong>
      <span>{describeSuggestedAction(action)}</span>
      <SuggestedActionPayloadPreview action={action} />
    </div>
  );
}

function SuggestedActionPayloadPreview({ action }: { action: AssistantSuggestedAction }) {
  if (action.type === "review_child_recommendations") {
    const recommendations = extractArrayOfRecords(action.payload, "childRecommendations");

    if (recommendations.length === 0) {
      return null;
    }

    return (
      <ul className={styles["assistant-suggested-action-list"]}>
        {recommendations.slice(0, 4).map((item, index) => (
          <li key={index}>
            <strong>{formatUnknownRecordValue(item.label) || formatUnknownRecordValue(item.query) || "Öneri"}</strong>
            <span>{formatUnknownRecordValue(item.reason)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (action.type === "review_saved_search_draft") {
    const savedSearches = extractArrayOfRecords(action.payload, "suggestedSearches");

    if (savedSearches.length === 0) {
      return null;
    }

    return (
      <ul className={styles["assistant-suggested-action-list"]}>
        {savedSearches.slice(0, 4).map((item, index) => (
          <li key={index}>
            <strong>{formatUnknownRecordValue(item.label) || "Kayıtlı arama taslağı"}</strong>
            <span>{formatUnknownRecordValue(item.query)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (action.type === "review_listing_draft") {
    return <span className={styles["assistant-suggested-action-note"]}>Bu yalnızca taslaktır; ilan kullanıcı onayı olmadan oluşturulmaz.</span>;
  }

  return null;
}

function describeSuggestedAction(action: AssistantSuggestedAction): string {
  switch (action.type) {
    case "open_listing":
      return "İlan detayını açar.";
    case "open_search":
      return "Arama sonuçlarını açar.";
    case "copy_questions":
      return "Satıcıya sorulacak güvenli soruları kopyalar.";
    case "review_saved_search_draft":
      return "Kayıtlı arama taslağını gösterir; otomatik kaydetmez.";
    case "review_listing_draft":
      return "İlan taslağını gösterir; otomatik ilan oluşturmaz.";
    case "review_child_recommendations":
      return "Yaş ve mevsime göre çocuk önerilerini gösterir; otomatik bildirim oluşturmaz.";
    default:
      return "Önerilen güvenli aksiyon.";
  }
}

function extractStringArray(payload: Record<string, unknown> | undefined, key: string): string[] {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function extractArrayOfRecords(payload: Record<string, unknown> | undefined, key: string): Array<Record<string, unknown>> {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function formatUnknownRecordValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
