"use client";

import type { FormEvent } from "react";
import { useState } from "react";
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
      <label className="form-field">
        Message
        <textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a short message"
        />
      </label>
      <div className="form-actions">
        {errorMessage ? <p className="form-error">{errorMessage}</p> : <p className="form-note">Messages are visible to conversation participants only.</p>}
        <button className="submit-button" disabled={isPending} type="submit">
          {isPending ? "Sending..." : "Send message"}
        </button>
      </div>
    </form>
  );
}
