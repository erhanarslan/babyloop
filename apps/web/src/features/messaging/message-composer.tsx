"use client";

import { moderateMessageBody } from "@babyloop/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, Textarea } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { sendMessage, type Message } from "./api";

type MessageComposerProps = {
  apiBaseUrl: string;
  conversationId: string;
  onSent: (message: Message) => void;
};

const SAFE_MESSAGE_PROMPTS = [
  "Condition and wear",
  "Included parts",
  "More photos",
  "Pickup timing"
];

export function MessageComposer({ apiBaseUrl, conversationId, onSent }: MessageComposerProps) {
  const { dictionary } = useI18n();
  const [body, setBody] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const composerGuidance = buildComposerGuidance(body);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setErrorMessage(dictionary.messaging.emptyMessage);
      return;
    }

    if (!moderateMessageBody(trimmedBody).allowed) {
      setErrorMessage(dictionary.messaging.messageBlocked);
      return;
    }

    setErrorMessage(null);
    setIsPending(true);

    try {
      const response = await sendMessage(apiBaseUrl, conversationId, trimmedBody);

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error, dictionary));
        return;
      }

      setBody("");
      onSent(response.data.message);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="message-composer message-composer-polished" onSubmit={handleSubmit}>
      <div className="message-composer-heading">
        <div>
          <p className="eyebrow">Plain-text message</p>
          <h2>Ask a clear item-specific question</h2>
          <p>
            Keep messages focused on the listing. Avoid unnecessary private details and do not paste HTML,
            scripts, payment credentials, or sensitive child information.
          </p>
        </div>
      </div>

      <div className="message-prompt-chips" aria-label="Suggested message topics">
        {SAFE_MESSAGE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setBody((currentBody) => appendPrompt(currentBody, prompt))}
          >
            {prompt}
          </button>
        ))}
      </div>

      <Textarea
        label={dictionary.messaging.messageLabel}
        maxLength={5000}
        rows={4}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={dictionary.messaging.messagePlaceholder}
      />
      {composerGuidance ? (
        <div className={`message-composer-guidance ${composerGuidance.tone}`}>
          {composerGuidance.message}
        </div>
      ) : null}

      <div className="message-composer-meta">
        <p className="form-note">{dictionary.publicPages.messaging.composerHint}</p>
        <span>{body.length}/5000</span>
      </div>

      <div className="message-composer-actions">
        {errorMessage ? (
          <Alert title={dictionary.messaging.sendFailed} message={errorMessage} />
        ) : (
          <p className="form-note">{dictionary.messaging.participantsOnly}</p>
        )}
        <Button disabled={isPending || body.trim().length === 0} type="submit">
          {isPending ? dictionary.messaging.sending : dictionary.messaging.sendMessage}
        </Button>
      </div>
    </form>
  );
}

function appendPrompt(currentBody: string, prompt: string): string {
  const addition = buildPromptSentence(prompt);

  if (!currentBody.trim()) {
    return addition;
  }

  if (currentBody.includes(addition)) {
    return currentBody;
  }

  return `${currentBody.trim()}\n${addition}`;
}

function buildPromptSentence(prompt: string): string {
  if (prompt === "Condition and wear") {
    return "Can you describe the condition, visible wear, and anything I should check closely?";
  }

  if (prompt === "Included parts") {
    return "Are all original parts, accessories, straps, manuals, or missing pieces included?";
  }

  if (prompt === "More photos") {
    return "Could you share clear photos from a few more angles before we decide?";
  }

  return "What pickup timing and handover expectations work best for you?";
}

function buildComposerGuidance(value: string): { tone: "info" | "warning"; message: string } | null {
  const normalized = value.trim();

  if (!normalized) {
    return {
      tone: "info",
      message: "Tip: ask about condition, included parts, pickup expectations, and clear photos before committing."
    };
  }

  if (/[<>]/.test(normalized) || /script/i.test(normalized)) {
    return {
      tone: "warning",
      message: "This message may look unsafe. Remove code-like text and keep the conversation focused on the item."
    };
  }

  if (/\b(phone|telefon|whatsapp|iban|password|şifre|sifre|card number|credit card)\b/i.test(normalized)) {
    return {
      tone: "warning",
      message: "Avoid sharing unnecessary private contact, payment, or credential details in marketplace chat."
    };
  }

  if (normalized.length > 1200) {
    return {
      tone: "warning",
      message: "This message is getting long. Short, specific questions are easier for the other parent to answer."
    };
  }

  if (normalized.length > 0 && normalized.length < 20) {
    return {
      tone: "info",
      message: "A little more detail can help: ask about condition, accessories, or pickup timing."
    };
  }

  return null;
}
