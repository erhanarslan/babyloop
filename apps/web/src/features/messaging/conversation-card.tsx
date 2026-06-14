"use client";

import Link from "next/link";
import { Badge } from "../../components/ui";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { formatDateTime } from "../listings/listing-display";
import type { ConversationSummary } from "./api";

type ConversationCardProps = {
  conversation: ConversationSummary;
  isUnread?: boolean;
};

export function ConversationCard({ conversation, isUnread = false }: ConversationCardProps) {
  const { dictionary, locale } = useI18n();
  const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;
  const hasListingContext = Boolean(conversation.contextListing);
  const latestMessage = conversation.latestMessage?.body?.trim() ?? "";
  const statusLabel = humanizeStatus(conversation.status);
  const unreadLabel = conversation.unreadCount === 1 ? "1 unread" : `${conversation.unreadCount} unread`;

  return (
    <article className={cn("conversation-card conversation-card-polished", isUnread && "conversation-card-unread")}>
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

      <div className="conversation-card-badges" aria-label="Conversation status">
        <Badge tone={isUnread ? "warning" : "neutral"}>
          {conversation.unreadCount > 0 ? unreadLabel : "Read"}
        </Badge>
        <Badge tone={hasListingContext ? "success" : "neutral"}>
          {hasListingContext ? "Listing context" : "No listing context"}
        </Badge>
        <Badge>{statusLabel}</Badge>
      </div>

      <div className="conversation-card-meta">
        <p>
          <strong>{dictionary.messaging.listing}</strong>
          <span>{conversation.contextListing?.title ?? dictionary.messaging.noListingContext}</span>
        </p>
      </div>

      {latestMessage ? (
        <p className="message-preview">{latestMessage}</p>
      ) : (
        <p className="muted">{dictionary.messaging.noMessagesSent}</p>
      )}

      <div className="conversation-safety-strip">
        <span>Participant-only thread · keep item details inside BabyLoop</span>
        {conversation.unreadCount > 0 ? <strong>{unreadLabel}</strong> : null}
      </div>

      <div className="listing-card-footer conversation-card-footer">
        <span className="conversation-status">
          <span>Use for condition, photos, pickup, and availability.</span>
        </span>
        <Link href={`/conversations/${conversation.id}`}>{dictionary.messaging.open}</Link>
      </div>
    </article>
  );
}

function humanizeStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
