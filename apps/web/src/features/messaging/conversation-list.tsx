"use client";

import { useEffect, useState } from "react";
import { EmptyState, LoadingBlock } from "../../components/ui";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { fetchConversations, type ConversationSummary } from "./api";
import { ConversationCard } from "./conversation-card";

type ConversationListProps = {
  apiBaseUrl: string;
};

export function ConversationList({ apiBaseUrl }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"auth" | "error" | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadConversations() {
      if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
        setState("auth");
        setMessage("Please log in to view your conversations.");
        setIsLoading(false);
        return;
      }

      try {
        const body = await fetchConversations(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setState(body.error.code === "FORBIDDEN" || body.error.code === "UNAUTHORIZED" ? "auth" : "error");
          setMessage(body.error.message);
          return;
        }

        setConversations(body.data.conversations);
      } catch {
        if (isActive) {
          setState("error");
          setMessage("BabyLoop API is unavailable.");
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
  }, [apiBaseUrl]);

  if (isLoading) {
    return <LoadingBlock title="Loading conversations" />;
  }

  if (message) {
    return (
      <EmptyState
        title={state === "auth" ? "Login required" : "Messages unavailable"}
        message={message}
        actionHref={state === "auth" ? "/login" : undefined}
        actionLabel={state === "auth" ? "Login" : undefined}
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations yet."
        message="Start from a listing detail page by messaging a seller."
        actionHref="/browse"
        actionLabel="Browse listings"
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
