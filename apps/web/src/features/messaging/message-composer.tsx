"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, Button, Textarea } from "../../components/ui";
import { sendMessage } from "./api";

type MessageComposerProps = {
  apiBaseUrl: string;
  conversationId: string;
  onSent: () => void;
};

export function MessageComposer({ apiBaseUrl, conversationId, onSent }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setErrorMessage("Message cannot be empty.");
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await sendMessage(apiBaseUrl, conversationId, trimmedBody);

      if (!response.ok) {
        setErrorMessage(response.error.message);
        return;
      }

      setBody("");
      onSent();
    } catch {
      setErrorMessage("BabyLoop API is unavailable.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <Textarea
        label="Message"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a short message"
      />
      <div className="form-actions">
        {errorMessage ? (
          <Alert title="Message was not sent" message={errorMessage} />
        ) : (
          <p className="form-note">Messages are visible to conversation participants only.</p>
        )}
        <Button disabled={isPending || body.trim().length === 0} type="submit">
          {isPending ? "Sending..." : "Send message"}
        </Button>
      </div>
    </form>
  );
}
