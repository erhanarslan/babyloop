import Link from "next/link";
import type { ConversationSummary } from "./api";

type ConversationCardProps = {
  conversation: ConversationSummary;
};

export function ConversationCard({ conversation }: ConversationCardProps) {
  const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;

  return (
    <article className="conversation-card">
      <div>
        <p className="listing-meta">Conversation with</p>
        <h2>{conversation.otherProfile.displayName}</h2>
      </div>
      <div className="conversation-card-meta">
        <p>
          <strong>Listing</strong>
          <span>{conversation.contextListing?.title ?? "No listing context"}</span>
        </p>
        <p>
          <strong>{conversation.lastMessageAt ? "Last message" : "Updated"}</strong>
          <span>{formatConversationTime(timestamp)}</span>
        </p>
      </div>
      {conversation.latestMessage ? (
        <p className="message-preview">{conversation.latestMessage.body}</p>
      ) : (
        <p className="muted">No messages have been sent yet.</p>
      )}
      <div className="listing-card-footer">
        <span>Status: {conversation.status}</span>
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
