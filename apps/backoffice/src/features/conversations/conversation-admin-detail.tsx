"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

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
        setErrorMessage(getApiErrorMessage(response, "Konuşma yüklenemedi."));
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
    return <div className="state-panel">Konuşma yükleniyor...</div>;
  }

  if (errorMessage) {
    return (
      <div className="state-panel danger" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (!conversation) {
    return <div className="state-panel">Konuşma bulunamadı.</div>;
  }

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Mesaj inceleme</p>
          <h2>{conversation.participants.map((item) => item.displayName).join(" ↔ ")}</h2>
          <p>
            Maskeli konuşma incelemesi. Ham mesaj gövdesi, raporlayan kimliği, e-posta ve iletişim
            verileri bu görünümde özellikle yer almaz.
          </p>
        </div>
        <Link className="secondary-action" href="/conversations">
          Mesajlara dön
        </Link>
      </div>

      <div className="profile-detail-layout">
        <article className="profile-detail-card">
          <h3>Konuşma özeti</h3>
          <dl className="details-grid">
            <div>
              <dt>Konuşma kimliği</dt>
              <dd>{conversation.conversationId}</dd>
            </div>
            <div>
              <dt>Durum</dt>
              <dd>{formatEnumLabel(conversation.status)}</dd>
            </div>
            <div>
              <dt>Mesaj sayısı</dt>
              <dd>{conversation.messageCount}</dd>
            </div>
            <div>
              <dt>Raporlanan mesaj</dt>
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
          </dl>
        </article>

        <article className="profile-detail-card">
          <h3>Katılımcılar</h3>
          <div className="table-list">
            {conversation.participants.map((participant) => (
              <div className="table-list-row" key={participant.profileId}>
                <div>
                  <strong>{participant.displayName}</strong>
                  <p className="muted">{participant.profileId}</p>
                </div>
                <span className={`status-badge ${participant.safetyStatus}`}>
                  {formatEnumLabel(participant.safetyStatus)}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="profile-detail-card">
          <h3>İlan bağlamı</h3>
          {conversation.contextListing ? (
            <dl className="details-grid">
              <div>
                <dt>İlan</dt>
                <dd>{conversation.contextListing.title}</dd>
              </div>
              <div>
                <dt>Durum</dt>
                <dd>{formatEnumLabel(conversation.contextListing.status)}</dd>
              </div>
              <div>
                <dt>İlan kimliği</dt>
                <dd>{conversation.contextListing.listingId}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Bu konuşmaya bağlı ilan bağlamı yok.</p>
          )}
        </article>

        <article className="profile-detail-card wide">
          <h3>Maskeli mesajlar</h3>
          {conversation.messages.length === 0 ? (
            <div className="state-panel">Mesaj bulunamadı.</div>
          ) : (
            <div className="table-list">
              {conversation.messages.map((message) => (
                <div className="table-list-row" key={message.messageId}>
                  <div>
                    <strong>{message.sender.displayName}</strong>
                    <p>{message.bodyPreview || "[boş önizleme]"}</p>
                    <p className="muted">
                      {message.messageId} · {formatDate(message.createdAt)}
                    </p>
                  </div>
                  <div className="side-stack">
                    <span className={`status-badge ${message.isHidden ? "archived" : "active"}`}>
                      {message.isHidden ? "Gizli" : "Görünür"}
                    </span>
                    <small className="muted">
                      rapor {message.reportCount} · açık vaka {message.openCaseCount} · işlem {message.enforcementCount}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="profile-detail-card wide">
          <h3>İlişkili moderasyon vakaları</h3>
          {conversation.relatedModerationCases.length === 0 ? (
            <div className="state-panel">Bu konuşmaya bağlı mesaj vakası yok.</div>
          ) : (
            <div className="table-list">
              {conversation.relatedModerationCases.map((item) => (
                <div className="table-list-row" key={item.caseId}>
                  <div>
                    <Link href={`/moderation/${item.caseId}`}>{item.caseId}</Link>
                    <p className="muted">
                      {item.reason ?? "Gerekçe yok"} · mesaj {item.targetId}
                    </p>
                  </div>
                  <span className={`status-badge ${item.status}`}>{formatEnumLabel(item.status)}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="profile-detail-card wide">
          <h3>Mesaj yaptırım geçmişi</h3>
          {conversation.enforcementHistory.length === 0 ? (
            <div className="state-panel">Henüz bağlı mesaj yaptırımı yok.</div>
          ) : (
            <div className="table-list">
              {conversation.enforcementHistory.map((item) => (
                <div className="table-list-row" key={item.actionId}>
                  <div>
                    <strong>{formatEnumLabel(item.actionType)}</strong>
                    <p className="muted">
                      {item.messageId ?? "bilinmeyen mesaj"} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  {item.caseId ? <Link href={`/moderation/${item.caseId}`}>Vakayı aç</Link> : null}
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
  return response.ok || response.error.code !== "FORBIDDEN"
    ? fallback
    : "Bu konuşmayı görüntüleme yetkin yok.";
}

function formatDate(value: string): string {
  return formatDateTimeTr(value);
}
