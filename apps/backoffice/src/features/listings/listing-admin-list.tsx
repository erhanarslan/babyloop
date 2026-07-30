"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminListingImageReviewStatus,
  type AdminListingPublicationState,
  type AdminListingSort,
  type AdminListingStatus,
  type AdminListingResponseSummary,
  listAdminListings,
} from "./api";
import { ListingPublicationSettingsCard } from "./listing-publication-settings-card";
import { useBackofficeAccess } from "../auth/backoffice-access";

type StatusFilter = AdminListingStatus | "all";
type ImageReviewStatusFilter = AdminListingImageReviewStatus | "all";
type PublicationStateFilter = AdminListingPublicationState | "all";

type FilterState = {
  status: StatusFilter;
  imageReviewStatus: ImageReviewStatusFilter;
  publicationState: PublicationStateFilter;
  q: string;
  sort: AdminListingSort;
  limit: number;
};

const statusFilters: StatusFilter[] = [
  "all",
  "draft",
  "active",
  "reserved",
  "sold",
  "archived",
];
const imageReviewStatusFilters: ImageReviewStatusFilter[] = [
  "all",
  "needs_review",
  "pending",
  "approved",
  "rejected",
];
const publicationStateFilters: PublicationStateFilter[] = [
  "all",
  "awaiting_images",
  "ai_review",
  "admin_review",
  "scheduled",
  "published",
  "changes_requested",
];
const sortOptions: AdminListingSort[] = [
  "newest",
  "oldest",
  "updated_desc",
  "updated_asc",
];
const limitOptions = [25, 50, 100];

const defaultFilters: FilterState = {
  status: "all",
  imageReviewStatus: "all",
  publicationState: "all",
  q: "",
  sort: "newest",
  limit: 50,
};

export function ListingAdminList() {
  const access = useBackofficeAccess();
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [listings, setListings] = useState<AdminListingResponseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadListings() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminListings({
        ...(appliedFilters.status === "all" ? {} : { status: appliedFilters.status }),
        ...(appliedFilters.imageReviewStatus === "all"
          ? {}
          : { imageReviewStatus: appliedFilters.imageReviewStatus }),
        ...(appliedFilters.publicationState === "all"
          ? {}
          : { publicationState: appliedFilters.publicationState }),
        ...(appliedFilters.q.trim() ? { q: appliedFilters.q.trim() } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setListings([]);
        setErrorMessage(getApiErrorMessage(response, "İlanlar yüklenemedi."));
        setIsLoading(false);
        return;
      }

      setListings(response.data.listings);
      setIsLoading(false);
    }

    void loadListings();

    return () => {
      isActive = false;
    };
  }, [appliedFilters]);

  function applyFilters() {
    setAppliedFilters({
      ...draftFilters,
      q: draftFilters.q.trim(),
    });
  }

  function resetFilters() {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  const isPublicationQueueActive =
    appliedFilters.publicationState === "admin_review" ||
    appliedFilters.publicationState === "ai_review";
  const loadedReviewCount = isPublicationQueueActive
    ? listings.length
    : listings.filter(isListingAwaitingPublicationReview).length;

  return (
    <div className="admin-page-stack">
      {access.can("mutate") ? <ListingPublicationSettingsCard /> : null}

      <section className="content-card">
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Pazar yeri operasyonları</p>
            <h2>İlan inceleme</h2>
            <p>
              İlan yaşam döngüsünü, yayın onayını, AI görsel sinyallerini ve moderasyon
              ilişkilerini tek kuyruktan yönet.
            </p>
          </div>
        </div>

        <div className="state-panel">
          <strong>{isPublicationQueueActive ? "Yayın inceleme kuyruğu açık" : "Yayın inceleme kuyruğu"}</strong>
          <p>Yüklenen sonuçlarda karar bekleyen ilan sayısı: {loadedReviewCount}.</p>
          <div className="form-button-row">
            <button
              className="secondary-action"
              disabled={isLoading}
              onClick={() => {
                const nextFilters: FilterState = {
                  ...draftFilters,
                  publicationState: "admin_review",
                  sort: "newest",
                };
                setDraftFilters(nextFilters);
                setAppliedFilters({ ...nextFilters, q: nextFilters.q.trim() });
              }}
              type="button"
            >
              Admin onayı bekleyenleri göster
            </button>
            <button
              className="secondary-action"
              disabled={isLoading}
              onClick={() => {
                const nextFilters: FilterState = {
                  ...draftFilters,
                  publicationState: "ai_review",
                  sort: "newest",
                };
                setDraftFilters(nextFilters);
                setAppliedFilters({ ...nextFilters, q: nextFilters.q.trim() });
              }}
              type="button"
            >
              AI inceleme kuyruğu
            </button>
            <button
              className="secondary-action"
              disabled={isLoading || !isPublicationQueueActive}
              onClick={resetFilters}
              type="button"
            >
              Kuyruk filtresini temizle
            </button>
          </div>
        </div>

        <form
          className="filter-panel"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="filter-grid">
            <label className="form-field">
              <span>Yaşam döngüsü</span>
              <select
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value as StatusFilter,
                  }))
                }
                value={draftFilters.status}
              >
                {statusFilters.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Yayın süreci</span>
              <select
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    publicationState: event.target.value as PublicationStateFilter,
                  }))
                }
                value={draftFilters.publicationState}
              >
                {publicationStateFilters.map((state) => (
                  <option key={state} value={state}>
                    {getPublicationStateLabel(state)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Görsel inceleme</span>
              <select
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    imageReviewStatus: event.target.value as ImageReviewStatusFilter,
                  }))
                }
                value={draftFilters.imageReviewStatus}
              >
                {imageReviewStatusFilters.map((status) => (
                  <option key={status} value={status}>
                    {getImageReviewStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Arama</span>
              <input
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, q: event.target.value }))
                }
                placeholder="İlan, başlık, kategori veya profil"
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
                    sort: event.target.value as AdminListingSort,
                  }))
                }
                value={draftFilters.sort}
              >
                {sortOptions.map((sort) => (
                  <option key={sort} value={sort}>
                    {getSortLabel(sort)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Limit</span>
              <select
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, limit: Number(event.target.value) }))
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
              Filtreleri uygula
            </button>
            <button className="secondary-action" disabled={isLoading} onClick={resetFilters} type="button">
              Sıfırla
            </button>
          </div>
        </form>

        {isLoading ? <div className="state-panel">İlanlar yükleniyor...</div> : null}
        {errorMessage ? (
          <div className="state-panel danger" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {!isLoading && !errorMessage && listings.length === 0 ? (
          <div className="state-panel">
            <strong>İlan bulunamadı</strong>
            <p>Bu filtrelerle eşleşen pazar yeri ilanı yok.</p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && listings.length > 0 ? (
          <div className="case-list">
            {listings.map((listing) => (
              <article
                className="case-card listing-admin-card"
                data-admin-listing-id={listing.id}
                data-admin-listing-status={listing.status}
                data-admin-publication-state={listing.publicationState}
                data-admin-primary-image-review-status={listing.primaryImage?.reviewStatus ?? "none"}
                key={listing.id}
              >
                <div className="listing-admin-card-body">
                  {listing.primaryImage ? (
                    <img alt="" className="listing-admin-thumbnail" src={listing.primaryImage.url} />
                  ) : (
                    <div className="listing-admin-thumbnail placeholder">Görsel yok</div>
                  )}

                  <div>
                    <div className="case-card-header">
                      <span className={`status-badge ${listing.status}`}>
                        {getStatusLabel(listing.status)}
                      </span>
                      <span className={`status-badge publication-${listing.publicationState}`}>
                        {getPublicationStateLabel(listing.publicationState)}
                      </span>
                      <span className="muted">{listing.category.name}</span>
                      {isListingAwaitingImageReview(listing) ? (
                        <span className="status-badge needs_review">Görsel incelemesi</span>
                      ) : null}
                    </div>

                    <h3>{listing.title}</h3>
                    <p>{listing.description ?? "Açıklama girilmemiş."}</p>

                    <dl className="compact-details">
                      <div><dt>Fiyat</dt><dd>{formatPrice(listing)}</dd></div>
                      <div><dt>Satıcı</dt><dd>{listing.seller.displayName}</dd></div>
                      <div><dt>Görsel</dt><dd>{listing.imageCount}</dd></div>
                      <div><dt>AI / ana görsel</dt><dd>{formatPrimaryImageReview(listing)}</dd></div>
                      {"moderation" in listing ? (
                        <div><dt>Açık vaka</dt><dd>{listing.moderation.openRelatedCaseCount}</dd></div>
                      ) : null}
                      <div><dt>Oluşturulma</dt><dd>{formatDateTime(listing.createdAt)}</dd></div>
                    </dl>
                  </div>
                </div>

                <Link className="secondary-action" href={`/listings/${listing.id}`}>
                  İncelemeyi aç
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function getStatusLabel(status: StatusFilter): string {
  switch (status) {
    case "all": return "Tümü";
    case "draft": return "Yayında değil";
    case "active": return "Yayında";
    case "reserved": return "Rezerve";
    case "sold": return "Satıldı";
    case "archived": return "Arşivde";
  }
}

function getPublicationStateLabel(state: PublicationStateFilter): string {
  switch (state) {
    case "all": return "Tümü";
    case "awaiting_images": return "Görsel bekliyor";
    case "ai_review": return "AI incelemesi";
    case "admin_review": return "Admin onayı";
    case "scheduled": return "Otomatik yayın sırası";
    case "published": return "Yayınlandı";
    case "changes_requested": return "Düzeltme istendi";
  }
}

function getImageReviewStatusLabel(status: ImageReviewStatusFilter): string {
  switch (status) {
    case "all": return "Tümü";
    case "pending": return "Bekliyor";
    case "approved": return "Onaylı";
    case "needs_review": return "İnceleme gerekli";
    case "rejected": return "Reddedildi";
  }
}

function getSortLabel(sort: AdminListingSort): string {
  switch (sort) {
    case "newest": return "En yeni";
    case "oldest": return "En eski";
    case "updated_desc": return "Son güncellenen";
    case "updated_asc": return "En eski güncelleme";
  }
}

function formatPrice(listing: AdminListingResponseSummary): string {
  return listing.price ? `${listing.price.amount} ${listing.price.currency}` : "Belirtilmedi";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

function getApiErrorMessage(response: ApiResponse<unknown>, fallback: string): string {
  if (response.ok) return fallback;
  return response.error?.message ?? fallback;
}

function isListingAwaitingImageReview(listing: AdminListingResponseSummary): boolean {
  return listing.primaryImage?.reviewStatus === "needs_review" || listing.primaryImage?.reviewStatus === "pending";
}

function isListingAwaitingPublicationReview(listing: AdminListingResponseSummary): boolean {
  return listing.publicationState === "admin_review" || listing.publicationState === "ai_review";
}

function formatPrimaryImageReview(listing: AdminListingResponseSummary): string {
  if (!listing.primaryImage) return "Görsel yok";
  const reviewStatus = getImageReviewStatusLabel(listing.primaryImage.reviewStatus);
  const aiDecision = "authenticity" in listing.primaryImage
    ? listing.primaryImage.authenticity.decision
    : null;
  return aiDecision ? `${reviewStatus} · AI ${aiDecision}` : reviewStatus;
}
