"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchConversations, type ConversationSummary } from "./api";
import { ConversationCard } from "./conversation-card";

type ConversationListProps = {
  apiBaseUrl: string;
};

export function ConversationList({ apiBaseUrl }: ConversationListProps) {
  const { dictionary } = useI18n();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"auth" | "error" | null>(null);
  const clearProtectedState = useCallback(() => {
    setConversations([]);
    setMessage(null);
    setState(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadConversations() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchConversations(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setState(body.error.code === "FORBIDDEN" || body.error.code === "UNAUTHORIZED" ? "auth" : "error");
          setMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setConversations(body.data.conversations);
      } catch {
        if (isActive) {
          setState("error");
          setMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadConversations();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary.common.apiUnavailable, requireAuth]);

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
        <ConversationCard conversation={conversation} key={conversation.id} />
      ))}
    </div>
  );
}
