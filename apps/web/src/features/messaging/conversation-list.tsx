"use client";

import { REALTIME_EVENTS, type ConversationUpdatedPayload } from "@babyloop/shared";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { getAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../../lib/realtime-client";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";
import { fetchConversations, type ConversationSummary } from "./api";
import { ConversationCard } from "./conversation-card";

type ConversationListProps = {
  apiBaseUrl: string;
};

export function ConversationList({ apiBaseUrl }: ConversationListProps) {
  const { dictionary } = useI18n();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [unreadConversationIds, setUnreadConversationIds] = useState<Set<string>>(() => new Set());
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
        setMessage(getApiErrorMessage(currentUserBody.error, dictionary));
        return;
      }

      if (!conversationsBody.ok) {
        setState(conversationsBody.error.code === "FORBIDDEN" || conversationsBody.error.code === "UNAUTHORIZED" ? "auth" : "error");
        setMessage(getApiErrorMessage(conversationsBody.error, dictionary));
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
      setMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

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

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title={dictionary.messaging.loadingConversations} />;
  }

  if (message) {
    return (
      <EmptyState
        title={state === "auth" ? dictionary.messaging.loginRequired : dictionary.messaging.messagesUnavailable}
        message={message}
        actionHref={state === "auth" ? "/login" : undefined}
        actionLabel={state === "auth" ? dictionary.common.login : undefined}
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title={dictionary.messaging.noConversationsTitle}
        message={dictionary.messaging.noConversationsBody}
        actionHref="/browse"
        actionLabel={dictionary.listings.browseListings}
      />
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => (
        <ConversationCard
          conversation={conversation}
          isUnread={unreadConversationIds.has(conversation.id)}
          key={conversation.id}
        />
      ))}
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
