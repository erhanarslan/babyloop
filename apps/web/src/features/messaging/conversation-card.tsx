import Link from "next/link";
import type { ConversationSummary } from "./api";

type ConversationCardProps = {
  conversation: ConversationSummary;
};

export function ConversationCard({ conversation }: ConversationCardProps) {
  return (
    <article className="conversation-card">
      <div>
        <p className="listing-meta">Conversation with</p>
        <h2>{conversation.otherProfile.displayName}</h2>
      </div>
      <p className="muted">
        {conversation.contextListing
          ? `Listing: ${conversation.contextListing.title}`
          : "No listing context"}
      </p>
      <div className="listing-card-footer">
        <span>{formatConversationTime(conversation.lastMessageAt ?? conversation.updatedAt)}</span>
        <Link href={`/conversations/${conversation.id}`}>Open</Link>
      </div>
    </article>
  );
}

function formatConversationTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
