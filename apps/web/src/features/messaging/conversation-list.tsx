"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthToken } from "../../lib/auth-client";
import { fetchConversations, type ConversationSummary } from "./api";
import { ConversationCard } from "./conversation-card";

type ConversationListProps = {
  apiBaseUrl: string;
};

export function ConversationList({ apiBaseUrl }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadConversations() {
      if (!getAuthToken()) {
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
          setMessage(body.error.message);
          return;
        }

        setConversations(body.data.conversations);
      } catch {
        if (isActive) {
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
    return (
      <div className="empty-state">
        <h2>Loading conversations</h2>
      </div>
    );
  }

  if (message) {
    return (
      <div className="empty-state">
        <h2>Messages unavailable</h2>
        <p>{message}</p>
        <Link className="primary-link" href="/login">
          Login
        </Link>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="empty-state">
        <h2>No conversations yet.</h2>
        <p>Start from a listing detail page by messaging a seller.</p>
        <Link className="primary-link" href="/browse">
          Browse listings
        </Link>
      </div>
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
