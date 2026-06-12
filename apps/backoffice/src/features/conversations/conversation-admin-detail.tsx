"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminConversationDetail,
  getAdminConversation,
} from "./api";

type ConversationAdminDetailProps = {
  conversationId: string;
};

export function ConversationAdminDetail({ conversationId }: ConversationAdminDetailProps) {
  const [conversation, setConversation] = useState<AdminConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadConversation() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminConversation(conversationId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setConversation(null);
        setErrorMessage(getApiErrorMessage(response, "Could not load conversation."));
        setIsLoading(false);
        return;
      }

      setConversation(response.data.conversation);
      setIsLoading(false);
    }

    void loadConversation();

    return () => {
      isActive = false;
    };
  }, [conversationId]);

  if (isLoading) {
    return <div className="state-panel">Loading conversation...</div>;
  }

  if (errorMessage) {
    return (
      <div className="state-panel danger" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (!conversation) {
    return <div className="state-panel">Conversation was not found.</div>;
  }

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Message Review</p>
          <h2>{conversation.participants.map((item) => item.displayName).join(" ↔ ")}</h2>
          <p>
            Redacted conversation review. Raw message body, reporter identity, email, and contact
            data are intentionally excluded from this view.
          </p>
        </div>
        <Link className="secondary-action" href="/conversations">
          Back to messages
        </Link>
      </div>

      <div className="profile-detail-layout">
        <article className="profile-detail-card">
          <h3>Conversation summary</h3>
          <dl className="details-grid">
            <div>
              <dt>Conversation id</dt>
              <dd>{conversation.conversationId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{conversation.status}</dd>
            </div>
            <div>
              <dt>Message count</dt>
              <dd>{conversation.messageCount}</dd>
            </div>
            <div>
              <dt>Reported messages</dt>
              <dd>{conversation.reportedMessageCount}</dd>
            </div>
            <div>
              <dt>Open cases</dt>
              <dd>{conversation.openCaseCount}</dd>
            </div>
            <div>
              <dt>Enforcements</dt>
              <dd>{conversation.enforcementCount}</dd>
            </div>
          </dl>
        </article>

        <article className="profile-detail-card">
          <h3>Participants</h3>
          <div className="table-list">
            {conversation.participants.map((participant) => (
              <div className="table-list-row" key={participant.profileId}>
                <div>
                  <strong>{participant.displayName}</strong>
                  <p className="muted">{participant.profileId}</p>
                </div>
                <span className={`status-badge ${participant.safetyStatus}`}>
                  {participant.safetyStatus}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="profile-detail-card">
          <h3>Listing context</h3>
          {conversation.contextListing ? (
            <dl className="details-grid">
              <div>
                <dt>Listing</dt>
                <dd>{conversation.contextListing.title}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{conversation.contextListing.status}</dd>
              </div>
              <div>
                <dt>Listing id</dt>
                <dd>{conversation.contextListing.listingId}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">No listing context is attached.</p>
          )}
        </article>

        <article className="profile-detail-card wide">
          <h3>Redacted messages</h3>
          {conversation.messages.length === 0 ? (
            <div className="state-panel">No messages found.</div>
          ) : (
            <div className="table-list">
              {conversation.messages.map((message) => (
                <div className="table-list-row" key={message.messageId}>
                  <div>
                    <strong>{message.sender.displayName}</strong>
                    <p>{message.bodyPreview || "[empty preview]"}</p>
                    <p className="muted">
                      {message.messageId} · {formatDate(message.createdAt)}
                    </p>
                  </div>
                  <div className="side-stack">
                    <span className={`status-badge ${message.isHidden ? "archived" : "active"}`}>
                      {message.isHidden ? "hidden" : "visible"}
                    </span>
                    <small className="muted">
                      reports {message.reportCount} · open {message.openCaseCount} · actions {message.enforcementCount}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="profile-detail-card wide">
          <h3>Related moderation cases</h3>
          {conversation.relatedModerationCases.length === 0 ? (
            <div className="state-panel">No message cases are linked to this conversation.</div>
          ) : (
            <div className="table-list">
              {conversation.relatedModerationCases.map((item) => (
                <div className="table-list-row" key={item.caseId}>
                  <div>
                    <Link href={`/moderation/${item.caseId}`}>{item.caseId}</Link>
                    <p className="muted">
                      {item.reason ?? "No reason"} · message {item.targetId}
                    </p>
                  </div>
                  <span className={`status-badge ${item.status}`}>{item.status}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="profile-detail-card wide">
          <h3>Message enforcement history</h3>
          {conversation.enforcementHistory.length === 0 ? (
            <div className="state-panel">No message enforcement actions are linked yet.</div>
          ) : (
            <div className="table-list">
              {conversation.enforcementHistory.map((item) => (
                <div className="table-list-row" key={item.actionId}>
                  <div>
                    <strong>{item.actionType}</strong>
                    <p className="muted">
                      {item.messageId ?? "unknown message"} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  {item.caseId ? <Link href={`/moderation/${item.caseId}`}>Open case</Link> : null}
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function getApiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  return response.ok ? fallback : response.error.message || fallback;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}
