"use client";

import { REALTIME_EVENTS } from "@babyloop/shared";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, EmptyState, LoadingBlock } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getAuthToken } from "../../lib/auth-client";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";
import { formatDateTime } from "../listings/listing-display";
import { dispatchNotificationUnreadCountUpdated } from "../notifications/unread-count-events";
import { fetchBlockedProfiles, reportMessage, reportProfile } from "../safety/api";
import { BlockProfileAction } from "../safety/block-profile-action";
import { ReportAction } from "../safety/report-action";
import {
  fetchConversation,
  fetchMessages,
  markConversationRead,
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
  const highlightTimersRef = useRef<number[]>([]);
  const hasInitialScrollRef = useRef(false);
  const markedReadKeyRef = useRef<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const readCandidateSourceRef = useRef<"initial" | "realtime" | null>(null);
  const readTargetRef = useRef<HTMLLIElement | null>(null);
  const readTimeoutRef = useRef<number | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(() => new Set());
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isOtherProfileBlocked, setIsOtherProfileBlocked] = useState(false);
  const [readCandidateMessageId, setReadCandidateMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"auth" | "forbidden" | "not-found" | "error" | null>(null);
  const clearProtectedState = useCallback(() => {
    setConversation(null);
    setMessages([]);
    setCurrentProfileId(null);
    setHighlightedMessageIds(new Set());
    setHasNewMessages(false);
    setIsOtherProfileBlocked(false);
    readCandidateSourceRef.current = null;
    setReadCandidateMessageId(null);
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
  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior) => {
    messageEndRef.current?.scrollIntoView({
      block: "end",
      behavior
    });
  }, []);

  const loadThread = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    try {
      const [currentUserBody, conversationBody, messagesBody, blockedProfilesBody] = await Promise.all([
        fetchCurrentUser(apiBaseUrl),
        fetchConversation(apiBaseUrl, conversationId),
        fetchMessages(apiBaseUrl, conversationId),
        fetchBlockedProfiles(apiBaseUrl)
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
      setIsOtherProfileBlocked(
        blockedProfilesBody.ok
          ? blockedProfilesBody.data.blockedProfiles.some(
              (profile) => profile.id === conversationBody.data.conversation.otherProfile.id
            )
          : false
      );
      const initialReadCandidateId =
        conversationBody.data.conversation.unreadCount > 0
          ? getLatestIncomingMessageId(messagesBody.data.messages, currentUserBody.data.profile.id)
          : null;

      readCandidateSourceRef.current = initialReadCandidateId ? "initial" : null;
      setReadCandidateMessageId(initialReadCandidateId);
    } catch {
      setState("error");
      setMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, conversationId, dictionary.common.apiUnavailable, dictionary, requireAuth]);

  const markCurrentThreadRead = useCallback(async () => {
    try {
      const body = await markConversationRead(apiBaseUrl, conversationId);

      if (!body.ok) {
        return;
      }

      setConversation(body.data.conversation);
      readCandidateSourceRef.current = null;
      setReadCandidateMessageId(null);
      setHasNewMessages(false);
      markedReadKeyRef.current = `${conversationId}:read`;
      dispatchNotificationUnreadCountUpdated(body.data.unreadNotificationCount);
    } catch {
      // Realtime read feedback is best-effort; the next refetch will reconcile state.
    }
  }, [apiBaseUrl, conversationId]);

  useEffect(() => {
    hasInitialScrollRef.current = false;
    markedReadKeyRef.current = null;
    readCandidateSourceRef.current = null;
    setIsLoading(true);
    setReadCandidateMessageId(null);
    setMessage(null);
    setState(null);
    void loadThread();
  }, [conversationId, loadThread]);

  useEffect(() => {
    if (!isLoading && messages.length > 0 && !hasInitialScrollRef.current) {
      hasInitialScrollRef.current = true;
      scrollToLatestMessage("auto");
    }
  }, [isLoading, messages.length, scrollToLatestMessage]);

  useEffect(() => {
    if (
      readCandidateSourceRef.current !== "initial" ||
      !readCandidateMessageId ||
      isLoading ||
      message ||
      !conversation?.id
    ) {
      return;
    }

    const readKey = `${conversationId}:${readCandidateMessageId}`;

    if (markedReadKeyRef.current === readKey) {
      return;
    }

    markedReadKeyRef.current = readKey;
    readTimeoutRef.current = window.setTimeout(() => {
      readTimeoutRef.current = null;
      void markCurrentThreadRead();
    }, 250);

    return () => {
      if (readTimeoutRef.current !== null) {
        window.clearTimeout(readTimeoutRef.current);
        readTimeoutRef.current = null;
      }
    };
  }, [
    conversation?.id,
    conversationId,
    isLoading,
    markCurrentThreadRead,
    message,
    readCandidateMessageId
  ]);

  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      highlightTimersRef.current = [];
      if (readTimeoutRef.current !== null) {
        window.clearTimeout(readTimeoutRef.current);
        readTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!readCandidateMessageId || isLoading || message || !conversation?.id) {
      return;
    }

    const readKey = `${conversationId}:${readCandidateMessageId}`;

    if (markedReadKeyRef.current === readKey) {
      return;
    }

    const target = readTargetRef.current;

    if (!target) {
      return;
    }

    function scheduleMarkRead() {
      if (markedReadKeyRef.current === readKey) {
        return;
      }

      markedReadKeyRef.current = readKey;
      readTimeoutRef.current = window.setTimeout(() => {
        readTimeoutRef.current = null;
        void markCurrentThreadRead();
      }, 250);
    }

    if (typeof IntersectionObserver === "undefined") {
      scheduleMarkRead();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scheduleMarkRead();
        }
      },
      {
        threshold: 0.6
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      if (readTimeoutRef.current !== null) {
        window.clearTimeout(readTimeoutRef.current);
        readTimeoutRef.current = null;
      }
    };
  }, [conversation?.id, conversationId, isLoading, markCurrentThreadRead, message, readCandidateMessageId]);

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
        const isIncoming = payload.message.sender.id !== currentProfileId;
        const shouldAutoScroll = isNearPageBottom();
        appendMessage(payload.message);

        if (isIncoming) {
          readCandidateSourceRef.current = "realtime";
          setReadCandidateMessageId(payload.message.id);
          setHighlightedMessageIds((currentIds) => {
            const nextIds = new Set(currentIds);
            nextIds.add(payload.message.id);
            return nextIds;
          });

          const timerId = window.setTimeout(() => {
            setHighlightedMessageIds((currentIds) => {
              const nextIds = new Set(currentIds);
              nextIds.delete(payload.message.id);
              return nextIds;
            });
          }, 2400);
          highlightTimersRef.current.push(timerId);
        }

        if (shouldAutoScroll) {
          window.setTimeout(() => scrollToLatestMessage("smooth"), 0);
        } else if (isIncoming) {
          setHasNewMessages(true);
        }
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
  }, [apiBaseUrl, appendMessage, conversation?.id, conversationId, currentProfileId, loadThread, markCurrentThreadRead, message]);

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
        <div className="detail-actions" aria-label={dictionary.safety.safetyActionsAriaLabel}>
          <ReportAction
            actionLabel={dictionary.safety.reportUser}
            onSubmitReport={(payload) => reportProfile(apiBaseUrl, conversation.otherProfile.id, payload)}
          />
          <BlockProfileAction
            apiBaseUrl={apiBaseUrl}
            initialBlocked={isOtherProfileBlocked}
            profileId={conversation.otherProfile.id}
            onBlockedChange={setIsOtherProfileBlocked}
          />
        </div>

        <ConversationSafetyGuide isOtherProfileBlocked={isOtherProfileBlocked} />
      </section>

      <section className="thread-panel">
        {messages.length === 0 ? (
          <EmptyState
            title={dictionary.messaging.noMessagesYet}
            message={dictionary.messaging.sendFirstMessage}
          />
        ) : (
          <>
            <ol className="message-list">
              {messages.map((item) => (
                <li
                  className={[
                    item.sender.id === currentProfileId
                      ? "message-bubble message-bubble-own"
                      : "message-bubble",
                    highlightedMessageIds.has(item.id) ? "message-bubble-new" : ""
                  ].filter(Boolean).join(" ")}
                  key={item.id}
                  ref={item.id === readCandidateMessageId ? readTargetRef : null}
                >
                  <div>
                    <strong>{item.sender.id === currentProfileId ? dictionary.messaging.you : item.sender.displayName}</strong>
                    <time>{formatDateTime(item.createdAt, locale)}</time>
                  </div>
                  <p>{item.deletedAt ? dictionary.messaging.deletedMessage : item.body}</p>
                  {item.sender.id !== currentProfileId ? (
                    <ReportAction
                      actionLabel={dictionary.safety.reportMessage}
                      onSubmitReport={(payload) => reportMessage(apiBaseUrl, item.id, payload)}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
            <div ref={messageEndRef} />
            {hasNewMessages ? (
              <button
                className="new-messages-button"
                type="button"
                onClick={() => {
                  setHasNewMessages(false);
                  scrollToLatestMessage("smooth");
                }}
              >
                {dictionary.messaging.newMessages}
              </button>
            ) : null}
          </>
        )}
        {isOtherProfileBlocked ? (
          <Alert
            tone="info"
            title={dictionary.safety.messagingBlockedTitle}
            message={dictionary.safety.cannotMessageUser}
          />
        ) : (
          <MessageComposer
            apiBaseUrl={apiBaseUrl}
            conversationId={conversationId}
            onSent={(sentMessage) => {
              appendMessage(sentMessage);
              window.setTimeout(() => scrollToLatestMessage("smooth"), 0);
            }}
          />
        )}
      </section>
    </div>
  );
}

function isNearPageBottom(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const page = document.documentElement;
  const distanceFromBottom = page.scrollHeight - window.scrollY - window.innerHeight;

  return distanceFromBottom < 240;
}


function ConversationSafetyGuide({ isOtherProfileBlocked }: { isOtherProfileBlocked: boolean }) {
  return (
    <section className="conversation-safety-guide" aria-label="Conversation safety guide">
      <div>
        <p className="eyebrow">Safe messaging</p>
        <h2>{isOtherProfileBlocked ? "This profile is blocked" : "Keep the conversation useful and safe"}</h2>
        <p className="form-note">
          Ask clear item questions, keep arrangements inside BabyLoop, and report anything misleading or unsafe.
        </p>
      </div>

      <ul className="question-list">
        <li>Confirm condition, missing parts, cleaning needs, and included accessories.</li>
        <li>Use clear pickup timing and avoid sharing unnecessary private details.</li>
        <li>Report pressure, suspicious requests, misleading item details, or unsafe behavior.</li>
      </ul>
    </section>
  );
}


function getLatestIncomingMessageId(messages: Message[], currentProfileId: string): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message && message.sender.id !== currentProfileId && !message.deletedAt) {
      return message.id;
    }
  }

  return null;
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
