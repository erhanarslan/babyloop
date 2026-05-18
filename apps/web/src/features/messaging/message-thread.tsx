"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAuthToken } from "../../lib/auth-client";
import {
  fetchConversation,
  fetchMessages,
  type ConversationSummary,
  type Message
} from "./api";
import { MessageComposer } from "./message-composer";

type MessageThreadProps = {
  apiBaseUrl: string;
  conversationId: string;
};

export function MessageThread({ apiBaseUrl, conversationId }: MessageThreadProps) {
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadThread = useCallback(async () => {
    if (!getAuthToken()) {
      setMessage("Please log in to view this conversation.");
      setIsLoading(false);
      return;
    }

    try {
      const [conversationBody, messagesBody] = await Promise.all([
        fetchConversation(apiBaseUrl, conversationId),
        fetchMessages(apiBaseUrl, conversationId)
      ]);

      if (!conversationBody.ok) {
        setMessage(conversationBody.error.message);
        return;
      }

      if (!messagesBody.ok) {
        setMessage(messagesBody.error.message);
        return;
      }

      setConversation(conversationBody.data.conversation);
      setMessages(messagesBody.data.messages);
    } catch {
      setMessage("BabyLoop API is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, conversationId]);

  useEffect(() => {
    setIsLoading(true);
    setMessage(null);
    void loadThread();
  }, [loadThread, reloadKey]);

  if (isLoading) {
    return (
      <div className="empty-state">
        <h2>Loading conversation</h2>
      </div>
    );
  }

  if (message) {
    return (
      <div className="empty-state">
        <h2>Conversation unavailable</h2>
        <p>{message}</p>
        {!getAuthToken() ? (
          <Link className="primary-link" href="/login">
            Login
          </Link>
        ) : (
          <Link className="primary-link" href="/conversations">
            Back to messages
          </Link>
        )}
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="message-thread-layout">
      <section className="thread-panel">
        <Link className="back-link" href="/conversations">
          Back to messages
        </Link>
        <p className="listing-meta">Conversation with</p>
        <h1>{conversation.otherProfile.displayName}</h1>
        <p className="muted">
          {conversation.contextListing
            ? `Listing: ${conversation.contextListing.title}`
            : "No listing context"}
        </p>
      </section>

      <section className="thread-panel">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>No messages yet.</h2>
            <p>Send the first message below.</p>
          </div>
        ) : (
          <ol className="message-list">
            {messages.map((item) => (
              <li className="message-bubble" key={item.id}>
                <div>
                  <strong>{item.sender.displayName}</strong>
                  <time>{formatMessageTime(item.createdAt)}</time>
                </div>
                <p>{item.deletedAt ? "This message was deleted." : item.body}</p>
              </li>
            ))}
          </ol>
        )}
        <MessageComposer
          apiBaseUrl={apiBaseUrl}
          conversationId={conversationId}
          onSent={() => setReloadKey((current) => current + 1)}
        />
      </section>
    </div>
  );
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
