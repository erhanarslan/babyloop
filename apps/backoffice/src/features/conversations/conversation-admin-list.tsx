"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  type AdminConversationSort,
  type AdminConversationSummary,
  listAdminConversations,
} from "./api";

type ConversationFilters = {
  q: string;
  sort: AdminConversationSort;
  limit: number;
};

const defaultFilters: ConversationFilters = {
  q: "",
  sort: "latest_desc",
  limit: 50,
};

const sortOptions: AdminConversationSort[] = ["latest_desc", "latest_asc", "newest", "oldest"];
const limitOptions = [25, 50, 100];

export function ConversationAdminList() {
  const [draftFilters, setDraftFilters] = useState<ConversationFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ConversationFilters>(defaultFilters);
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadConversations() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminConversations({
        ...(appliedFilters.q.trim() ? { q: appliedFilters.q.trim() } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setConversations([]);
        setErrorMessage(getApiErrorMessage(response, "Could not load conversations."));
        setIsLoading(false);
        return;
      }

      setConversations(response.data.conversations);
      setIsLoading(false);
    }

    void loadConversations();

    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      ...draftFilters,
      q: draftFilters.q.trim(),
    });
  }

  function resetFilters() {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Trust & Safety</p>
          <h2>Messages</h2>
          <p>
            Review conversation safety signals with redacted message previews. Raw message bodies,
            reporter identity, email, and contact data stay out of this admin view.
          </p>
        </div>
      </div>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="form-field">
            <span>Search</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Participant name, profile id, or conversation id"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Sort</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  sort: event.target.value as AdminConversationSort,
                }))
              }
              value={draftFilters.sort}
            >
              {sortOptions.map((sort) => (
                <option key={sort} value={sort}>
                  {formatSort(sort)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Limit</span>
            <select
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                }))
              }
              value={draftFilters.limit}
            >
              {limitOptions.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <button className="primary-action" disabled={isLoading} type="submit">
            Apply filters
          </button>
          <button
            className="secondary-action"
            disabled={isLoading}
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>

      {isLoading ? <div className="state-panel">Loading conversations...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && conversations.length === 0 ? (
        <div className="state-panel">No conversations match these filters.</div>
      ) : null}

      {conversations.length > 0 ? (
        <div className="profile-admin-grid">
          {conversations.map((conversation) => (
            <article className="profile-admin-card" key={conversation.conversationId}>
              <div className="profile-admin-card-header">
                <div>
                  <strong>{conversation.participants.map((item) => item.displayName).join(" ↔ ")}</strong>
                  <p>Conversation {conversation.conversationId}</p>
                </div>
                <span className={`status-badge ${conversation.status}`}>
                  {formatStatus(conversation.status)}
                </span>
              </div>

              <div className="profile-snapshot-summary">
                <strong>Latest redacted message</strong>
                <p>{conversation.latestMessage?.bodyPreview ?? "No messages yet."}</p>
              </div>

              <dl className="compact-details">
                <div>
                  <dt>Messages</dt>
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
                <div>
                  <dt>Listing context</dt>
                  <dd>{conversation.contextListing?.title ?? "None"}</dd>
                </div>
                <div>
                  <dt>Last message</dt>
                  <dd>{formatDate(conversation.lastMessageAt)}</dd>
                </div>
              </dl>

              <Link
                className="secondary-action profile-detail-link"
                href={`/conversations/${conversation.conversationId}`}
              >
                Review conversation
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getApiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  return response.ok ? fallback : response.error.message || fallback;
}

function formatSort(sort: AdminConversationSort): string {
  switch (sort) {
    case "latest_asc":
      return "Latest message asc";
    case "newest":
      return "Newest conversations";
    case "oldest":
      return "Oldest conversations";
    case "latest_desc":
    default:
      return "Latest message desc";
  }
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}
