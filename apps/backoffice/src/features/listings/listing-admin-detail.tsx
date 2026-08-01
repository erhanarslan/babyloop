"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminListingAuditEvent,
  type AdminListingDetail as AdminListingDetailType,
  type ViewerListingDetail,
  getAdminListing,
} from "./api";
import { ListingImageReviewPanel } from "./listing-image-review-panel";
import { ListingPublicationReviewPanel } from "./listing-publication-review-panel";
import { ListingStatusActionForm } from "./listing-status-action-form";
import { formatDateTimeTr, formatEnumLabel } from "../../lib/presentation";
import { RelatedModerationCases } from "./related-moderation-cases";
import { useBackofficeAccess } from "../auth/backoffice-access";

type ListingAdminDetailProps = {
  listingId: string;
};

export function ListingAdminDetail({ listingId }: ListingAdminDetailProps) {
  const access = useBackofficeAccess();
  const [listing, setListing] = useState<AdminListingDetailType | ViewerListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadListing() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminListing(listingId);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setListing(null);
        setErrorMessage(getApiErrorMessage(response, "İlan yüklenemedi."));
        setIsLoading(false);
        return;
      }

      setListing(response.data.listing);
      setIsLoading(false);
    }

    void loadListing();

    return () => {
      isActive = false;
    };
  }, [listingId]);

  if (isLoading) {
    return <div className="state-panel">İlan yükleniyor…</div>;
  }

  if (errorMessage) {
    return (
      <div className="state-panel danger" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="state-panel">
        <strong>İlan bulunamadı</strong>
      </div>
    );
  }

  const needsReviewImages = listing.images.filter((image) => image.reviewStatus === "needs_review");
  const fullListing = "actionEligibility" in listing ? listing : null;

  return (
    <div className="detail-layout">
      <section className="content-card">
        <Link className="secondary-action" href="/listings">
          İlanlara dön
        </Link>

        {needsReviewImages.length > 0 ? (
          <div
            className="state-panel"
            data-admin-images-awaiting-review-panel={listing.id}
          >
            <strong>İnceleme bekleyen görseller</strong>
            <p>
              {needsReviewImages.length} görsel onaylanana kadar herkese açık ilan
              yanıtlarında gizlenir.
            </p>
          </div>
        ) : null}

        <div className="page-toolbar">
          <div>
            <p className="eyebrow">İlan incelemesi</p>
            <h2>{listing.title}</h2>
            <p>{listing.description ?? "Açıklama belirtilmedi."}</p>
          </div>

          <div className="case-card-header">
            <span className={`status-badge ${listing.status}`}>
              {getStatusLabel(listing.status)}
            </span>
            <span className={`status-badge publication-${listing.publicationState}`}>
              {getPublicationStateLabel(listing.publicationState)}
            </span>
          </div>
        </div>

        <dl className="details-grid">
          <div>
            <dt>İlan kimliği</dt>
            <dd>{listing.id}</dd>
          </div>
          <div>
            <dt>Durum</dt>
            <dd>{getStatusLabel(listing.status)}</dd>
          </div>
          <div>
            <dt>Yayın süreci</dt>
            <dd>{getPublicationStateLabel(listing.publicationState)}</dd>
          </div>
          <div>
            <dt>Planlanan yayın</dt>
            <dd>{listing.publishAfter ? formatDateTime(listing.publishAfter) : "—"}</dd>
          </div>
          <div>
            <dt>Yayınlanma</dt>
            <dd>{listing.publishedAt ? formatDateTime(listing.publishedAt) : "—"}</dd>
          </div>
          <div>
            <dt>Fiyat</dt>
            <dd>{formatPrice(listing)}</dd>
          </div>
          <div>
            <dt>Tür</dt>
            <dd>{formatEnumLabel(listing.listingType)}</dd>
          </div>
          <div>
            <dt>Durum</dt>
            <dd>{formatEnumLabel(listing.condition)}</dd>
          </div>
          <div>
            <dt>Kategori</dt>
            <dd>{listing.category.name}</dd>
          </div>
          <div>
            <dt>Oluşturulma</dt>
            <dd>{formatDateTime(listing.createdAt)}</dd>
          </div>
          <div>
            <dt>Güncellenme</dt>
            <dd>{formatDateTime(listing.updatedAt)}</dd>
          </div>
          <div>
            <dt>İnceleme bekleyen görseller</dt>
            <dd>{needsReviewImages.length}</dd>
          </div>
        </dl>

        {fullListing?.publicationReviewReason ? (
          <section className="note-panel warning">
            <h3>Son düzeltme gerekçesi</h3>
            <p>{fullListing.publicationReviewReason}</p>
          </section>
        ) : null}

        <section className="note-panel">
          <h3>Satıcı özeti</h3>
          <p>
            Yalnız gizliliği koruyan profil özeti gösterilir. Satıcı e-postası,
            telefonu ve ham kullanıcı kayıtları bu inceleme görünümüne eklenmez.
          </p>
          <dl className="details-grid">
            <div>
              <dt>Profil kimliği</dt>
              <dd>{listing.seller.profileId}</dd>
            </div>
            <div>
              <dt>Görünen ad</dt>
              <dd>{listing.seller.displayName}</dd>
            </div>
            <div>
              <dt>Şehir</dt>
              <dd>{listing.seller.locationCity ?? "Belirtilmedi"}</dd>
            </div>
            <div>
              <dt>Profil oluşturulma</dt>
              <dd>{formatDateTime(listing.seller.createdAt)}</dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="side-stack">
        {access.can("mutate") && fullListing ? (
          <>
            <ListingPublicationReviewPanel listing={fullListing} onApplied={setListing} />
            <ListingStatusActionForm listing={fullListing} onApplied={setListing} />
            <ListingImageReviewPanel
              images={fullListing.images}
              listingId={fullListing.id}
              onReviewed={setListing}
            />
            <RelatedModerationCases cases={fullListing.relatedModerationCases} />
          </>
        ) : null}
      </section>

      {fullListing ? <section className="content-card full-span">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Denetim</p>
            <h2>İlan işlemleri denetimi</h2>
            <p>
              İlan kapsamındaki güvenli yönetici hareketleri, görsel incelemeleri ve
              ilgili moderasyon yaptırımları gösterilir. Hassas erişim ayrı tutulur.
            </p>
          </div>
        </div>

        {fullListing.auditTrail.length === 0 ? (
          <div className="state-panel">Henüz ilan işlemi denetim kaydı yok.</div>
        ) : (
          <div className="timeline">
            {fullListing.auditTrail.map((event) => (
              <article className="timeline-item audit_event" key={event.id}>
                <div>
                  <strong>{getAuditEventLabel(event)}</strong>
                  <p>{event.eventType}</p>
                </div>

                <dl className="compact-details">
                  <div>
                    <dt>İşlemi yapan</dt>
                    <dd>{event.actor?.displayName ?? event.actor?.id ?? "Sistem"}</dd>
                  </div>
                  <div>
                    <dt>Oluşturulma</dt>
                    <dd>{formatDateTime(event.createdAt)}</dd>
                  </div>
                </dl>

                <div className="metadata-chip-row">
                  {Object.entries(sanitizeAdminListingAuditMetadata(event.metadata)).map(([key, value]) => (
                    <span className="metadata-chip" key={`${event.id}:${key}`}>
                      <strong>{formatMetadataKey(key)}</strong>
                      {formatMetadataValue(value)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section> : null}
    </div>
  );
}

function getStatusLabel(status: string): string {
  return formatEnumLabel(status);
}


function getPublicationStateLabel(
  state: AdminListingDetailType["publicationState"],
): string {
  switch (state) {
    case "awaiting_images":
      return "Görsel bekliyor";
    case "ai_review":
      return "AI / görsel incelemesi";
    case "admin_review":
      return "Admin onayı bekliyor";
    case "scheduled":
      return "Otomatik yayın sırası";
    case "published":
      return "Yayında";
    case "changes_requested":
      return "Düzeltme istendi";
  }
}

function formatPrice(listing: AdminListingDetailType | ViewerListingDetail): string {
  return listing.price
    ? `${listing.price.amount} ${listing.price.currency}`
    : "Belirtilmedi";
}

function formatDateTime(value: string): string {
  return formatDateTimeTr(value);
}

function getAuditEventLabel(event: AdminListingAuditEvent): string {
  if (event.eventType === "admin_listing_action_applied") {
    const action = event.metadata.action;

    if (action === "archive") {
      return "İlan arşivlendi";
    }

    if (action === "restore") {
      return "İlan geri yüklendi";
    }
  }

  if (event.eventType === "listing_publication_approved") {
    return "İlan yayınlandı";
  }

  if (event.eventType === "listing_publication_changes_requested") {
    return "İlanda düzeltme istendi";
  }

  if (event.eventType === "listing_auto_published") {
    return "İlan otomatik yayınlandı";
  }

  if (event.eventType === "listing_publication_state_changed") {
    return "Yayın süreci güncellendi";
  }

  if (event.eventType === "admin_listing_image_review_applied") {
    const action = event.metadata.action;

    if (action === "approve") {
      return "Görsel onaylandı";
    }

    if (action === "reject") {
      return "Görsel reddedildi";
    }
  }

  if (event.eventType === "admin_moderation_enforcement") {
    return "Moderasyon yaptırımı uygulandı";
  }

  return "İlan denetim kaydı";
}

const SAFE_ADMIN_LISTING_AUDIT_METADATA_KEYS = [
  "action",
  "enforcementAction",
  "authenticityDecision",
  "authenticityProvider",
  "imageId",
  "listingId",
  "moderationActionId",
  "nextStatus",
  "nextReviewStatus",
  "nextPublicationState",
  "previousStatus",
  "previousPublicationState",
  "previousReviewStatus",
  "publishAfter",
  "reasonLength",
  "result",
  "resultingStatus",
  "targetId",
  "targetType"
];

function sanitizeAdminListingAuditMetadata(
  metadata: Record<string, string | number | boolean | string[] | null>,
): Record<string, string | number | boolean | string[] | null> {
  const safeMetadata: Record<string, string | number | boolean | string[] | null> = {};

  for (const key of SAFE_ADMIN_LISTING_AUDIT_METADATA_KEYS) {
    const value = metadata[key];

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      (Array.isArray(value) && value.every((item) => typeof item === "string"))
    ) {
      safeMetadata[key] = value;
    }
  }

  return safeMetadata;
}

function formatMetadataKey(key: string): string {
  const labels: Record<string, string> = {
    action: "İşlem",
    authenticityDecision: "Özgünlük kararı",
    authenticityProvider: "Özgünlük sağlayıcısı",
    imageId: "Görsel kimliği",
    listingId: "İlan kimliği",
    nextReviewStatus: "Sonraki inceleme durumu",
    previousReviewStatus: "Önceki inceleme durumu",
    reasonLength: "Neden uzunluğu"
  };
  return labels[key] ?? key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMetadataValue(
  value: string | number | boolean | string[] | null,
): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => formatEnumLabel(item)).join(", ") : "Yok";
  }

  if (value === null) {
    return "Yok";
  }

  return typeof value === "string" ? formatEnumLabel(value) : String(value);
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Bu ilanı görüntüleme yetkin yok."
    : fallback;
}
