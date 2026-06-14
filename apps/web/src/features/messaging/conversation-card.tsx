"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { formatDateTime, formatListingStatus } from "../listings/listing-display";
import type { ConversationSummary } from "./api";

type ConversationCardProps = {
  conversation: ConversationSummary;
  isUnread?: boolean;
};

export function ConversationCard({ conversation, isUnread = false }: ConversationCardProps) {
  const { dictionary, locale } = useI18n();
  const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;

  return (
    <article className={cn("conversation-card", isUnread && "conversation-card-unread")}>
      <div className="conversation-card-header">
        <div>
          <p className="listing-meta">
            {isUnread ? <span className="unread-dot" aria-label={dictionary.messaging.unreadConversation} /> : null}
            {dictionary.messaging.conversationWith}
          </p>
          <h2>{conversation.otherProfile.displayName}</h2>
        </div>
        <time>{formatDateTime(timestamp, locale)}</time>
      </div>
      <div className="conversation-card-meta">
        <p>
          <strong>{dictionary.messaging.listing}</strong>
          <span>{conversation.contextListing?.title ?? dictionary.messaging.noListingContext}</span>
        </p>
      </div>
      {conversation.latestMessage ? (
        <p className="message-preview">{conversation.latestMessage.body}</p>
      ) : (
        <p className="muted">{dictionary.messaging.noMessagesSent}</p>
      )}

      <div className="conversation-safety-strip">
        <span>Keep details inside BabyLoop</span>
        {conversation.unreadCount > 0 ? <strong>{conversation.unreadCount} unread</strong> : null}
      </div>

      <div className="listing-card-footer">
        <span className="conversation-status">
          <span>{dictionary.messaging.statusLabel}: {formatListingStatus(conversation.status, dictionary)}</span>
          {conversation.unreadCount > 0 ? (
            <strong>{conversation.unreadCount}</strong>
          ) : null}
        </span>
        <Link href={`/conversations/${conversation.id}`}>{dictionary.messaging.open}</Link>
      </div>
    </article>
  );
}
