"use client";

import { REALTIME_EVENTS } from "@babyloop/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getAuthToken } from "../../lib/auth-client";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";
import { formatDateTime } from "../listings/listing-display";
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
  const { dictionary, locale } = useI18n();
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"auth" | "forbidden" | "not-found" | "error" | null>(null);
  const clearProtectedState = useCallback(() => {
    setConversation(null);
    setMessages([]);
    setCurrentProfileId(null);
    setMessage(null);
    setState(null);
    setIsLoading(false);
  }, []);
  const appendMessage = useCallback((nextMessage: Message) => {
    setMessages((currentMessages) => {
      if (currentMessages.some((currentMessage) => currentMessage.id === nextMessage.id)) {
        return currentMessages;
      }

      return [...currentMessages, nextMessage];
    });
    setConversation((currentConversation) =>
      currentConversation
        ? {
            ...currentConversation,
            latestMessage: {
              body: nextMessage.body,
              createdAt: nextMessage.createdAt,
              senderProfileId: nextMessage.sender.id
            },
            lastMessageAt: nextMessage.createdAt,
            updatedAt: nextMessage.createdAt
          }
        : currentConversation
    );
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  const loadThread = useCallback(async () => {
    if (!(await requireAuth())) {
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
        setMessage(getApiErrorMessage(currentUserBody.error, dictionary));
        return;
      }

      if (!conversationBody.ok) {
        setState(getErrorState(conversationBody.error.code));
        setMessage(getApiErrorMessage(conversationBody.error, dictionary));
        return;
      }

      if (!messagesBody.ok) {
        setState(getErrorState(messagesBody.error.code));
        setMessage(getApiErrorMessage(messagesBody.error, dictionary));
        return;
      }

      setCurrentProfileId(currentUserBody.data.profile.id);
      setConversation(conversationBody.data.conversation);
      setMessages(messagesBody.data.messages);
    } catch {
      setState("error");
      setMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, conversationId, dictionary.common.apiUnavailable, requireAuth]);

  useEffect(() => {
    setIsLoading(true);
    setMessage(null);
    setState(null);
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!conversation?.id || !currentProfileId || message) {
      return;
    }

    const socket = getRealtimeSocket(apiBaseUrl, getAuthToken());

    if (!socket) {
      return;
    }

    const realtimeSocket = socket;

    function joinConversation() {
      realtimeSocket.emit(REALTIME_EVENTS.conversationJoin, {
        conversationId
      });
    }

    function handleMessageCreated(payload: {
      conversationId: string;
      message: Message;
    }) {
      if (payload.conversationId === conversationId) {
        appendMessage(payload.message);
      }
    }

    function handleReconnect() {
      void loadThread();
      joinConversation();
    }

    joinConversation();
    realtimeSocket.on(REALTIME_EVENTS.messageCreated, handleMessageCreated);
    realtimeSocket.io.on("reconnect", handleReconnect);

    return () => {
      realtimeSocket.emit(REALTIME_EVENTS.conversationLeave, {
        conversationId
      });
      realtimeSocket.off(REALTIME_EVENTS.messageCreated, handleMessageCreated);
      realtimeSocket.io.off("reconnect", handleReconnect);
    };
  }, [apiBaseUrl, appendMessage, conversation?.id, conversationId, currentProfileId, loadThread, message]);

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title={dictionary.messaging.loadingConversation} />;
  }

  if (message) {
    return (
      <EmptyState
        title={getErrorTitle(state, dictionary)}
        message={message}
        actionHref={state === "auth" ? "/login" : "/conversations"}
        actionLabel={state === "auth" ? dictionary.common.login : dictionary.messaging.backToMessages}
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
          {dictionary.messaging.backToMessages}
        </Link>
        <p className="listing-meta">{dictionary.messaging.conversationWith}</p>
        <h1>{conversation.otherProfile.displayName}</h1>
        <div className="thread-meta-grid">
          <p>
            <strong>{dictionary.messaging.listing}</strong>
            {conversation.contextListing ? (
              <Link href={`/listings/${conversation.contextListing.id}`}>
                {conversation.contextListing.title}
              </Link>
            ) : (
              <span>{dictionary.messaging.noListingContext}</span>
            )}
          </p>
          <p>
            <strong>{dictionary.messaging.created}</strong>
            <span>{formatDateTime(conversation.createdAt, locale)}</span>
          </p>
          <p>
            <strong>{conversation.lastMessageAt ? dictionary.messaging.lastMessage : dictionary.messaging.updated}</strong>
            <span>{formatDateTime(conversation.lastMessageAt ?? conversation.updatedAt, locale)}</span>
          </p>
        </div>
      </section>

      <section className="thread-panel">
        {messages.length === 0 ? (
          <EmptyState
            title={dictionary.messaging.noMessagesYet}
            message={dictionary.messaging.sendFirstMessage}
          />
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
                  <strong>{item.sender.id === currentProfileId ? dictionary.messaging.you : item.sender.displayName}</strong>
                  <time>{formatDateTime(item.createdAt, locale)}</time>
                </div>
                <p>{item.deletedAt ? dictionary.messaging.deletedMessage : item.body}</p>
              </li>
            ))}
          </ol>
        )}
        <MessageComposer
          apiBaseUrl={apiBaseUrl}
          conversationId={conversationId}
          onSent={appendMessage}
        />
      </section>
    </div>
  );
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

function getErrorTitle(
  state: "auth" | "forbidden" | "not-found" | "error" | null,
  dictionary: Dictionary
): string {
  if (state === "auth") {
    return dictionary.messaging.loginRequired;
  }

  if (state === "forbidden") {
    return dictionary.messaging.accessDenied;
  }

  if (state === "not-found") {
    return dictionary.messaging.conversationNotFound;
  }

  return dictionary.messaging.conversationUnavailable;
}
