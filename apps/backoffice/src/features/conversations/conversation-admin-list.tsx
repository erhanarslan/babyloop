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
        setErrorMessage(getApiErrorMessage(response, "Konuşmalar yüklenemedi."));
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
          <p className="eyebrow">Güven ve güvenlik</p>
          <h2>Mesaj incelemeleri</h2>
          <p>
            Redacted mesaj önizlemeleriyle konuşma güvenlik sinyallerini incele. Ham mesaj gövdesi,
            raporlayan kimliği, e-posta ve iletişim verileri bu admin görünümünde yer almaz.
          </p>
        </div>
      </div>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="form-field">
            <span>Arama</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Katılımcı adı, profil ID veya konuşma ID"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Sıralama</span>
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
            Filtrele
          </button>
          <button
            className="secondary-action"
            disabled={isLoading}
            onClick={resetFilters}
            type="button"
          >
            Sıfırla
          </button>
        </div>
      </form>

      {isLoading ? <div className="state-panel">Konuşmalar yükleniyor...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && conversations.length === 0 ? (
        <div className="state-panel">Bu filtrelerle eşleşen konuşma yok.</div>
      ) : null}

      {conversations.length > 0 ? (
        <div className="profile-admin-grid">
          {conversations.map((conversation) => (
            <article className="profile-admin-card" key={conversation.conversationId}>
              <div className="profile-admin-card-header">
                <div>
                  <strong>{conversation.participants.map((item) => item.displayName).join(" ↔ ")}</strong>
                  <p>Konuşma {conversation.conversationId}</p>
                </div>
                <span className={`status-badge ${conversation.status}`}>
                  {formatStatus(conversation.status)}
                </span>
              </div>

              <div className="profile-snapshot-summary">
                <strong>Son redacted mesaj</strong>
                <p>{conversation.latestMessage?.bodyPreview ?? "Henüz mesaj yok."}</p>
              </div>

              <dl className="compact-details">
                <div>
                  <dt>Mesaj</dt>
                  <dd>{conversation.messageCount}</dd>
                </div>
                <div>
                  <dt>Raporlanan</dt>
                  <dd>{conversation.reportedMessageCount}</dd>
                </div>
                <div>
                  <dt>Açık vaka</dt>
                  <dd>{conversation.openCaseCount}</dd>
                </div>
                <div>
                  <dt>Yaptırım</dt>
                  <dd>{conversation.enforcementCount}</dd>
                </div>
                <div>
                  <dt>İlan bağlamı</dt>
                  <dd>{conversation.contextListing?.title ?? "Yok"}</dd>
                </div>
                <div>
                  <dt>Son mesaj</dt>
                  <dd>{formatDate(conversation.lastMessageAt)}</dd>
                </div>
              </dl>

              <Link
                className="secondary-action profile-detail-link"
                href={`/conversations/${conversation.conversationId}`}
              >
                Konuşmayı incele
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
      return "Son mesaj artan";
    case "newest":
      return "Yeni konuşmalar";
    case "oldest":
      return "Eski konuşmalar";
    case "latest_desc":
    default:
      return "Son mesaj azalan";
  }
}

function formatStatus(status: string): string {
  return status === "active" ? "Aktif" : status.replaceAll("_", " ");
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}
