"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  type AdminAuditEvent,
  type AdminAuditSort,
  listAdminAuditEvents,
} from "./api";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";

type AuditFilters = {
  eventType: string;
  entityType: string;
  q: string;
  sort: AdminAuditSort;
  limit: number;
};

const defaultFilters: AuditFilters = {
  eventType: "",
  entityType: "",
  q: "",
  sort: "newest",
  limit: 50,
};

export function AuditEventList() {
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(defaultFilters);
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadEvents() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminAuditEvents({
        ...(appliedFilters.eventType ? { eventType: appliedFilters.eventType } : {}),
        ...(appliedFilters.entityType ? { entityType: appliedFilters.entityType } : {}),
        ...(appliedFilters.q ? { q: appliedFilters.q } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setEvents([]);
        setErrorMessage(getApiErrorMessage(response, "Denetim kayıtları yüklenemedi."));
        setIsLoading(false);
        return;
      }

      setEvents(response.data.events);
      setIsLoading(false);
    }

    void loadEvents();

    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      ...filters,
      eventType: filters.eventType.trim(),
      entityType: filters.entityType.trim(),
      q: filters.q.trim(),
    });
  }

  function handleReset() {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">Güven ve Emniyet</p>
        <h2>Denetim kayıtları</h2>
        <p>
          Yönetici işlemleri için güvenli görünürlük sağlar. Üst veri izin listelidir;
          ham neden, e-posta, mesaj gövdesi, token veya özel nesne içermez.
        </p>
      </section>

      <form className="filter-panel" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <label className="form-field">
            <span>Olay türü</span>
            <input
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  eventType: event.target.value,
                }))
              }
              placeholder="admin_profile_enforcement_applied"
              value={filters.eventType}
            />
          </label>

          <label className="form-field">
            <span>Varlık türü</span>
            <input
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  entityType: event.target.value,
                }))
              }
              placeholder="moderation_case"
              value={filters.entityType}
            />
          </label>

          <label className="form-field">
            <span>Güvenli arama</span>
            <input
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Kimlik veya olay türü"
              value={filters.q}
            />
          </label>

          <label className="form-field">
            <span>Sıralama</span>
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sort: event.target.value as AdminAuditSort,
                }))
              }
              value={filters.sort}
            >
              <option value="newest">Önce en yeni</option>
              <option value="oldest">Önce en eski</option>
            </select>
          </label>

          <label className="form-field">
            <span>Sayfa boyutu</span>
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                }))
              }
              value={filters.limit}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <button className="primary-action" type="submit">
            Filtreleri uygula
          </button>
          <button className="secondary-action" onClick={handleReset} type="button">
            Sıfırla
          </button>
        </div>
      </form>

      {isLoading ? <div className="state-panel">Denetim kayıtları yükleniyor…</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && events.length === 0 ? (
        <div className="state-panel">Bu filtrelerle eşleşen denetim kaydı yok.</div>
      ) : null}

      {events.length > 0 ? (
        <section className="timeline" aria-label="Denetim kayıtları">
          {events.map((event) => (
            <article className="timeline-item audit_event" key={event.id}>
              <div>
                <strong>{formatEventType(event.eventType)}</strong>
                <p>
                  {formatEnumLabel(event.entityType)} · {event.entityId}
                </p>
              </div>

              <dl className="compact-details">
                <div>
                  <dt>İşlemi yapan profil</dt>
                  <dd>{event.actorProfileId ?? "Sistem"}</dd>
                </div>
                <div>
                  <dt>Oluşturulma</dt>
                  <dd>{formatDateTime(event.createdAt)}</dd>
                </div>
              </dl>

              {Object.keys(event.metadata).length > 0 ? (
                <div className="metadata-chip-row">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <span className="metadata-chip" key={`${event.id}:${key}`}>
                      <strong>{formatMetadataKey(key)}</strong>
                      {formatMetadataValue(value)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">Bu olay için gösterilebilir güvenli üst veri yok.</p>
              )}

              <div className="filter-actions">
                {getSafeResourceLinks(event).map((link) => (
                  <Link className="secondary-action" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

function getSafeResourceLinks(event: AdminAuditEvent): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];
  const caseId = getStringMetadata(event.metadata.caseId);
  const listingId = getStringMetadata(event.metadata.listingId);

  if (event.entityType === "moderation_case") {
    links.push({
      href: `/moderation/${event.entityId}`,
      label: "Vakayı aç",
    });
  }

  if (caseId && event.entityType !== "moderation_case") {
    links.push({
      href: `/moderation/${caseId}`,
      label: "Vakayı aç",
    });
  }

  if (event.entityType === "listing") {
    links.push({
      href: `/listings/${event.entityId}`,
      label: "İlanı aç",
    });
  }

  if (listingId && event.entityType !== "listing") {
    links.push({
      href: `/listings/${listingId}`,
      label: "İlanı aç",
    });
  }

  return links;
}

function getStringMetadata(
  value: string | number | boolean | string[] | null | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    admin_email_test_send_completed: "Kontrollü e-posta testi tamamlandı",
    admin_email_test_send_failed: "Kontrollü e-posta testi başarısız",
    admin_email_test_send_started: "Kontrollü e-posta testi başlatıldı",
    admin_profile_enforcement_applied: "Yönetici profil yaptırımı uygulandı",
    listing_auto_published: "İlan otomatik yayımlandı",
    listing_status_changed: "İlan durumu değişti"
  };
  if (labels[eventType]) return labels[eventType];
  return eventType
    .split("_")
    .map((part) => formatEnumLabel(part))
    .join(" ");
}

function formatMetadataKey(key: string): string {
  const labels: Record<string, string> = {
    action: "İşlem",
    actorProfileId: "İşlemi yapan profil",
    category: "Kategori",
    intent: "Senaryo",
    profileId: "Profil kimliği",
    nextStatus: "Sonraki durum",
    previousStatus: "Önceki durum",
    provider: "Sağlayıcı",
    reason: "Neden"
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function formatMetadataValue(
  value: string | number | boolean | string[] | null,
): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null) {
    return "Yok";
  }

  return typeof value === "string" ? formatEnumLabel(value) : String(value);
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Denetim kayıtlarını görüntüleme yetkin yok."
    : fallback;
}
