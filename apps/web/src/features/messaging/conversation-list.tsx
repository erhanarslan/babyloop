"use client";

import { REALTIME_EVENTS, type ConversationUpdatedPayload } from "@babyloop/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getAuthToken } from "../../lib/auth-client";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";
import { fetchConversations, type ConversationSummary } from "./api";
import { ConversationCard } from "./conversation-card";

type ConversationListProps = {
  apiBaseUrl: string;
  getConversationHref?: (conversationId: string) => string;
  selectedConversationId?: string | undefined;
};

type ConversationFilter = "all" | "unread" | "active";

const FILTERS: Array<{ label: string; value: ConversationFilter }> = [
  { label: "Tümü", value: "all" },
  { label: "Okunmamış", value: "unread" },
  { label: "Aktif ilanlar", value: "active" }
];

export function ConversationList({
  apiBaseUrl,
  getConversationHref,
  selectedConversationId
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [unreadConversationIds, setUnreadConversationIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"auth" | "error" | null>(null);
  const clearProtectedState = useCallback(() => {
    setConversations([]);
    setCurrentProfileId(null);
    setUnreadConversationIds(new Set());
    setMessage(null);
    setState(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  const loadConversations = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    try {
      const [currentUserBody, conversationsBody] = await Promise.all([
        fetchCurrentUser(apiBaseUrl),
        fetchConversations(apiBaseUrl)
      ]);

      if (!currentUserBody.ok) {
        setState("auth");
        setMessage("Mesajlarını görmek için giriş yapmalısın.");
        return;
      }

      if (!conversationsBody.ok) {
        setState(conversationsBody.error.code === "FORBIDDEN" || conversationsBody.error.code === "UNAUTHORIZED" ? "auth" : "error");
        setMessage("Mesajlar şu anda yüklenemiyor.");
        return;
      }

      setCurrentProfileId(currentUserBody.data.profile.id);
      setConversations(conversationsBody.data.conversations);
      setUnreadConversationIds(
        new Set(
          conversationsBody.data.conversations
            .filter((conversation) => conversation.unreadCount > 0)
            .map((conversation) => conversation.id)
        )
      );
      setMessage(null);
      setState(null);
    } catch {
      setState("error");
      setMessage("Mesajlar şu anda yüklenemiyor.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, requireAuth]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (isCheckingAuth || isLoading || message || !currentProfileId) {
      return;
    }

    const socket = getRealtimeSocket(apiBaseUrl, getAuthToken());

    if (!socket) {
      return;
    }

    const realtimeSocket = socket;

    function handleConversationUpdated(payload: ConversationUpdatedPayload) {
      setConversations((currentConversations) =>
        sortConversations([
          payload.conversation,
          ...currentConversations.filter((conversation) => conversation.id !== payload.conversationId)
        ])
      );

      if (
        payload.conversation.unreadCount > 0
      ) {
        setUnreadConversationIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(payload.conversationId);
          return nextIds;
        });
      } else {
        setUnreadConversationIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(payload.conversationId);
          return nextIds;
        });
      }
    }

    function handleReconnect() {
      void loadConversations();
    }

    realtimeSocket.on(REALTIME_EVENTS.conversationUpdated, handleConversationUpdated);
    realtimeSocket.io.on("reconnect", handleReconnect);

    return () => {
      realtimeSocket.off(REALTIME_EVENTS.conversationUpdated, handleConversationUpdated);
      realtimeSocket.io.off("reconnect", handleReconnect);
    };
  }, [apiBaseUrl, currentProfileId, isCheckingAuth, isLoading, loadConversations, message]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return sortConversations(conversations).filter((conversation) => {
      if (filter === "unread" && conversation.unreadCount === 0 && !unreadConversationIds.has(conversation.id)) {
        return false;
      }

      if (filter === "active" && !conversation.contextListing) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        conversation.otherProfile.displayName,
        conversation.contextListing?.title,
        conversation.latestMessage?.body
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return searchableText.includes(normalizedQuery);
    });
  }, [conversations, filter, query, unreadConversationIds]);

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title="Mesajlar yükleniyor" />;
  }

  if (message) {
    return (
      <EmptyState
        title={state === "auth" ? "Giriş gerekli" : "Mesajlar açılamadı"}
        message={message}
        actionHref={state === "auth" ? "/login" : undefined}
        actionLabel={state === "auth" ? "Giriş yap" : undefined}
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="Henüz konuşman yok"
        message="Bir ilanla ilgili soru sorduğunda konuşmaların burada görünecek."
        actionHref="/browse"
        actionLabel="İlanları keşfet"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Mesajlar</h1>
        <p className="text-sm font-medium leading-6 text-muted-foreground">
          Ürün sorularını ve konuşmalarını BabyLoop içinde güvenle takip et.
        </p>
      </div>

      <label className="sr-only" htmlFor="conversation-search">
        Konuşma veya ilan ara
      </label>
      <input
        className="h-11 rounded-full border border-border bg-background px-4 text-sm font-semibold outline-none transition placeholder:text-muted-foreground/70 focus:border-rose-300 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900"
        id="conversation-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Konuşma veya ilan ara"
        type="search"
        value={query}
      />

      <div className="flex flex-wrap gap-2" aria-label="Mesaj filtreleri">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            className={[
              "rounded-full border px-3 py-1.5 text-sm font-black transition",
              filter === item.value
                ? "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100"
                : "border-border bg-background text-muted-foreground hover:border-rose-200 hover:text-foreground"
            ].join(" ")}
            type="button"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filteredConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm font-semibold text-muted-foreground">
          Bu filtreyle eşleşen konuşma yok.
        </div>
      ) : (
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {filteredConversations.map((conversation) => (
            <ConversationCard
              conversation={conversation}
              currentProfileId={currentProfileId}
              href={getConversationHref?.(conversation.id)}
              isSelected={conversation.id === selectedConversationId}
              isUnread={unreadConversationIds.has(conversation.id)}
              key={conversation.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function sortConversations(conversations: ConversationSummary[]): ConversationSummary[] {
  return [...conversations].sort((left, right) => {
    const leftTimestamp = left.lastMessageAt ?? left.updatedAt;
    const rightTimestamp = right.lastMessageAt ?? right.updatedAt;

    return rightTimestamp.localeCompare(leftTimestamp);
  });
}
