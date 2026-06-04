"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { fetchCurrentUser } from "../auth/api";
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
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"auth" | "forbidden" | "not-found" | "error" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadThread = useCallback(async () => {
    if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
      setState("auth");
      setMessage("Please log in to view this conversation.");
      setIsLoading(false);
      return;
    }

    try {
      const [currentUserBody, conversationBody, messagesBody] = await Promise.all([
        fetchCurrentUser(apiBaseUrl),
        fetchConversation(apiBaseUrl, conversationId),
        fetchMessages(apiBaseUrl, conversationId)
      ]);

      if (!currentUserBody.ok) {
        setState("auth");
        setMessage(currentUserBody.error.message);
        return;
      }

      if (!conversationBody.ok) {
        setState(getErrorState(conversationBody.error.code));
        setMessage(conversationBody.error.message);
        return;
      }

      if (!messagesBody.ok) {
        setState(getErrorState(messagesBody.error.code));
        setMessage(messagesBody.error.message);
        return;
      }

      setCurrentProfileId(currentUserBody.data.profile.id);
      setConversation(conversationBody.data.conversation);
      setMessages(messagesBody.data.messages);
    } catch {
      setState("error");
      setMessage("BabyLoop API is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, conversationId]);

  useEffect(() => {
    setIsLoading(true);
    setMessage(null);
    setState(null);
    void loadThread();
  }, [loadThread, reloadKey]);

  if (isLoading) {
    return <LoadingBlock title="Loading conversation" />;
  }

  if (message) {
    return (
      <EmptyState
        title={getErrorTitle(state)}
        message={message}
        actionHref={state === "auth" ? "/login" : "/conversations"}
        actionLabel={state === "auth" ? "Login" : "Back to messages"}
      />
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
        <div className="thread-meta-grid">
          <p>
            <strong>Listing</strong>
            {conversation.contextListing ? (
              <Link href={`/listings/${conversation.contextListing.id}`}>
                {conversation.contextListing.title}
              </Link>
            ) : (
              <span>No listing context</span>
            )}
          </p>
          <p>
            <strong>Created</strong>
            <span>{formatMessageTime(conversation.createdAt)}</span>
          </p>
          <p>
            <strong>{conversation.lastMessageAt ? "Last message" : "Updated"}</strong>
            <span>{formatMessageTime(conversation.lastMessageAt ?? conversation.updatedAt)}</span>
          </p>
        </div>
      </section>

      <section className="thread-panel">
        {messages.length === 0 ? (
          <EmptyState title="No messages yet." message="Send the first message below." />
        ) : (
          <ol className="message-list">
            {messages.map((item) => (
              <li
                className={
                  item.sender.id === currentProfileId
                    ? "message-bubble message-bubble-own"
                    : "message-bubble"
                }
                key={item.id}
              >
                <div>
                  <strong>{item.sender.id === currentProfileId ? "You" : item.sender.displayName}</strong>
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

function getErrorState(code: string): "auth" | "forbidden" | "not-found" | "error" {
  if (code === "UNAUTHORIZED") {
    return "auth";
  }

  if (code === "FORBIDDEN") {
    return "forbidden";
  }

  if (code === "NOT_FOUND") {
    return "not-found";
  }

  return "error";
}

function getErrorTitle(state: "auth" | "forbidden" | "not-found" | "error" | null): string {
  if (state === "auth") {
    return "Login required";
  }

  if (state === "forbidden") {
    return "Access denied";
  }

  if (state === "not-found") {
    return "Conversation not found";
  }

  return "Conversation unavailable";
}
