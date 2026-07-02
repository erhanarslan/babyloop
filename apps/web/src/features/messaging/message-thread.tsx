"use client";

import { REALTIME_EVENTS } from "@babyloop/shared";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, EmptyState, LoadingBlock } from "../../components/ui";
import { getAuthToken } from "../../lib/auth-client";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";
import { dispatchNotificationUnreadCountUpdated } from "../notifications/unread-count-events";
import { dispatchConversationReadStateUpdated } from "./conversation-read-events";
import { fetchBlockedProfiles, reportProfile } from "../safety/api";
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
        setMessage("Konuşmayı görmek için giriş yapmalısın.");
        return;
      }

      if (!conversationBody.ok) {
        setState(getErrorState(conversationBody.error.code));
        setMessage(getThreadErrorMessage(conversationBody.error.code));
        return;
      }

      if (!messagesBody.ok) {
        setState(getErrorState(messagesBody.error.code));
        setMessage(getThreadErrorMessage(messagesBody.error.code));
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
      setMessage("Konuşma şu anda yüklenemiyor.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, conversationId, requireAuth]);

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
      dispatchConversationReadStateUpdated({
        conversation: body.data.conversation,
        unreadConversationCount: body.data.unreadConversationCount,
        unreadNotificationCount: body.data.unreadNotificationCount,
      });
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
    return <LoadingBlock title="Konuşma yükleniyor" />;
  }

  if (message) {
    return (
      <EmptyState
        title={getErrorTitle(state)}
        message={message}
        actionHref={state === "auth" ? "/login" : "/conversations"}
        actionLabel={state === "auth" ? "Giriş yap" : "Mesajlar"}
      />
    );
  }

  if (!conversation) {
    return null;
  }

  const listingTitle = conversation.contextListing?.title ?? "İlan bilgisi yok";
  const listingStatusLabel = conversation.contextListing ? "İlan açık" : "İlan kapalı";

  return (
    <div className="message-thread-p0 flex min-h-[calc(100dvh-150px)] w-full min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-border bg-background shadow-sm lg:h-[calc(100dvh-190px)] lg:min-h-[620px]">
      <section className="message-thread-p0-header border-b border-border bg-background/95 p-3 sm:p-4">
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm font-black text-rose-700 hover:text-rose-800 dark:text-rose-200 lg:hidden"
          href="/conversations"
        >
          <span aria-hidden="true">&#8592;</span>
          Mesajlar
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-teal-100 text-sm font-black text-neutral-800 dark:from-rose-900/50 dark:to-teal-900/50 dark:text-neutral-100"
            >
              {getInitials(conversation.otherProfile.displayName)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight text-foreground">
                {conversation.otherProfile.displayName}
              </h1>
              <p className="truncate text-sm font-semibold text-muted-foreground">{listingTitle}</p>
            </div>
          </div>
          <span className="message-thread-p0-status w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
            {listingStatusLabel}
          </span>
        </div>

        <div className="message-thread-p0-context mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">

            {conversation.contextListing ? (
              <Link
                className="mt-1 block truncate text-sm font-black text-foreground hover:text-rose-700"
                href={`/listings/${conversation.contextListing.id}`}
              >
                {conversation.contextListing.title}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Bu konuşmaya bağlı ilan kapalı olabilir.</p>
            )}
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            {formatTurkishDateTime(conversation.lastMessageAt ?? conversation.updatedAt)}
          </p>
        </div>

        <details className="message-thread-p0-safety mt-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm">
          <summary className="cursor-pointer font-black text-muted-foreground">Bildir / engelle</summary>
          <div className="mt-3 grid gap-3" aria-label="Güvenlik işlemleri">
            <ReportAction
              actionLabel="Konuşmayı bildir"
              onSubmitReport={(payload) => reportProfile(apiBaseUrl, conversation.otherProfile.id, payload)}
            />
            <BlockProfileAction
              apiBaseUrl={apiBaseUrl}
              initialBlocked={isOtherProfileBlocked}
              profileId={conversation.otherProfile.id}
              onBlockedChange={setIsOtherProfileBlocked}
            />
          </div>
        </details>
      </section>

      <section className="message-thread-p0-body flex min-h-0 flex-1 flex-col bg-gradient-to-b from-muted/20 to-background">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <EmptyState
              title="Henüz mesaj yok"
              message="İlanla ilgili ilk sorunu yazarak konuşmayı başlatabilirsin."
            />
          </div>
        ) : (
          <>
            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {messages.map((item) => (
                <li
                  className={[
                    "flex",
                    item.sender.id === currentProfileId ? "justify-end" : "justify-start"
                  ].filter(Boolean).join(" ")}
                  key={item.id}
                  ref={item.id === readCandidateMessageId ? readTargetRef : null}
                >
                  <div
                    className={[
                      "message-thread-p0-bubble max-w-[82%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-[68%]",
                      item.sender.id === currentProfileId
                        ? "message-thread-p0-bubble-own rounded-br-md text-white"
                        : "message-thread-p0-bubble-other rounded-bl-md border border-border bg-background text-foreground",
                      highlightedMessageIds.has(item.id) ? "ring-2 ring-rose-300" : ""
                    ].join(" ")}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[0.7rem] font-black opacity-80">
                      <strong>{item.sender.id === currentProfileId ? "Sen" : item.sender.displayName}</strong>
                      <time>{formatTurkishDateTime(item.createdAt)}</time>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {item.deletedAt ? "Bu mesaj silindi." : item.body}
                    </p>
                  </div>
                </li>
              ))}
              <li aria-hidden="true" className="h-1">
                <div ref={messageEndRef} />
              </li>
            </ol>
            {hasNewMessages ? (
              <button
                className="message-thread-p0-new mx-auto mb-3 rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                type="button"
                onClick={() => {
                  setHasNewMessages(false);
                  scrollToLatestMessage("smooth");
                }}
              >
                Yeni mesajlar
              </button>
            ) : null}
          </>
        )}
        {isOtherProfileBlocked ? (
          <Alert
            tone="info"
            title="Mesajlaşma durduruldu"
            message="Bu kullanıcı engellendiği için yeni mesaj gönderemezsin."
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
  state: "auth" | "forbidden" | "not-found" | "error" | null
): string {
  if (state === "auth") {
    return "Giriş gerekli";
  }

  if (state === "forbidden") {
    return "Bu konuşmaya erişemezsin";
  }

  if (state === "not-found") {
    return "Konuşma bulunamadı";
  }

  return "Konuşma açılamadı";
}

function getThreadErrorMessage(code: string): string {
  if (code === "UNAUTHORIZED") {
    return "Konuşmayı görmek için giriş yapmalısın.";
  }

  if (code === "FORBIDDEN") {
    return "Bu konuşma yalnızca katılımcılar tarafından görülebilir.";
  }

  if (code === "NOT_FOUND") {
    return "Konuşma bulunamadı.";
  }

  return "Konuşma şu anda yüklenemiyor.";
}

function formatTurkishDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date);
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "BL";
  }

  return parts.map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "").join("");
}
