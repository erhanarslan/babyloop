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

export function MessageComposer({ apiBaseUrl, conversationId, onSent }: MessageComposerProps) {
  const { dictionary } = useI18n();
  const [body, setBody] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <form className="message-composer" onSubmit={handleSubmit}>
      <Textarea
        label={dictionary.messaging.messageLabel}
        maxLength={5000}
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={dictionary.messaging.messagePlaceholder}
      />
      <div className="form-actions">
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
