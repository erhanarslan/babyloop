"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { formatDateTime, formatListingStatus } from "../listings/listing-display";
import type { ConversationSummary } from "./api";

type ConversationCardProps = {
  conversation: ConversationSummary;
};

export function ConversationCard({ conversation }: ConversationCardProps) {
  const { dictionary, locale } = useI18n();
  const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;

  return (
    <article className="conversation-card">
      <div>
        <p className="listing-meta">{dictionary.messaging.conversationWith}</p>
        <h2>{conversation.otherProfile.displayName}</h2>
      </div>
      <div className="conversation-card-meta">
        <p>
          <strong>{dictionary.messaging.listing}</strong>
          <span>{conversation.contextListing?.title ?? dictionary.messaging.noListingContext}</span>
        </p>
        <p>
          <strong>{conversation.lastMessageAt ? dictionary.messaging.lastMessage : dictionary.messaging.updated}</strong>
          <span>{formatDateTime(timestamp, locale)}</span>
        </p>
      </div>
      {conversation.latestMessage ? (
        <p className="message-preview">{conversation.latestMessage.body}</p>
      ) : (
        <p className="muted">{dictionary.messaging.noMessagesSent}</p>
      )}
      <div className="listing-card-footer">
        <span>
          {dictionary.messaging.statusLabel}: {formatListingStatus(conversation.status, dictionary)}
        </span>
        <Link href={`/conversations/${conversation.id}`}>{dictionary.messaging.open}</Link>
      </div>
    </article>
  );
}
