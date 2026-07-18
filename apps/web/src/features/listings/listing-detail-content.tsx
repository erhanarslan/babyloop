"use client";

import { type KeyboardEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, EmptyState, PageContainer, PageHeading } from "../../components/ui";
import { FavoriteButton } from "../../features/favorites/favorite-button";
import { AddToCartButton } from "../../features/cart/add-to-cart-button";
import { MessageSellerButton } from "../../features/messaging/message-seller-button";
import { fetchCurrentUser } from "../../features/auth/api";
import { reportListing } from "../../features/safety/api";
import { ReportAction } from "../../features/safety/report-action";
import { recordProductEvent } from "../../features/product-events/api";
import type { ListingDetailPayload } from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { RecentlyViewedTracker } from "./recently-viewed-tracker";
import { ListingShareButton } from "./listing-share-button";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
  formatListingType
} from "./listing-display";

type ListingDetailContentProps = {
  apiBaseUrl: string;
  listing: ListingDetailPayload["listing"];
};

type CurrentUserState = {
  status: "checking" | "guest" | "known" | "error";
  profileId: string | null;
};

export function ListingDetailContent({
  apiBaseUrl,
  listing
}: ListingDetailContentProps) {
  const { dictionary } = useI18n();
  const [currentUser, setCurrentUser] = useState<CurrentUserState>({
    status: "checking",
    profileId: null
  });

  useEffect(() => {
    void recordProductEvent(apiBaseUrl, {
      categoryId: listing.category.id,
      eventType: "listing_detail_viewed",
      listingId: listing.id,
      source: "listing_detail"
    });
  }, [apiBaseUrl, listing.category.id, listing.id]);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
        if (isActive) {
          setCurrentUser({ status: "guest", profileId: null });
        }
        return;
      }

      try {
        const body = await fetchCurrentUser(apiBaseUrl);

        if (!isActive) {
          return;
        }

        setCurrentUser(
          body.ok
            ? { status: "known", profileId: body.data.profile.id }
            : { status: "error", profileId: null }
        );
      } catch {
        if (isActive) {
          setCurrentUser({ status: "error", profileId: null });
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  const isOwner = currentUser.status === "known" && currentUser.profileId === listing.seller.id;
  const canShowBuyerActions = currentUser.status === "guest" || (currentUser.status === "known" && !isOwner);
  const categoryName = formatCategoryName(listing.category, dictionary);
  const condition = formatListingCondition(listing.condition, dictionary);
  const listingType = formatListingType(listing.listingType, dictionary);
  const listingStatus = formatListingStatus(listing.status, dictionary);
  const canAddToCart = listing.status === "active" && listing.listingType !== "donation";

  return (
    <PageContainer className="listing-detail-p0-shell pb-12 pt-5" ariaLabel="İlan detayları">
      {!isOwner && currentUser.status !== "checking" ? <RecentlyViewedTracker listing={listing} /> : null}

      <Link className="listing-detail-back-link" href="/browse">
        <BackArrowIcon />
        <span>İlanlara dön</span>
      </Link>

      <ImageReviewNotice
        title={dictionary.listings.imageNeedsReviewTitle}
        message={dictionary.listings.imageNeedsReviewBody}
      />

      <div className="listing-detail-p0-grid">
        <section className="listing-detail-p0-gallery-card" aria-label={dictionary.listings.imageGalleryAriaLabel}>
          <ListingDetailGallery
            apiBaseUrl={apiBaseUrl}
            listing={listing}
          />
        </section>

        <aside className="listing-detail-p0-panel" aria-label="İlan özeti">
          <div className="listing-detail-p0-badges">
            <Badge>{categoryName}</Badge>
            <Badge>{listingType}</Badge>
            <Badge>{condition}</Badge>
            <Badge tone={listing.status === "reserved" ? "warning" : "success"}>{listingStatus}</Badge>
          </div>

          <div className="listing-detail-p0-title">
            <div className="listing-detail-p0-title-head">
              <h1>{listing.title}</h1>
              <ListingShareButton
                apiBaseUrl={apiBaseUrl}
                listingId={listing.id}
                title={listing.title}
              />
            </div>
            <strong>{formatListingPrice(listing.price, dictionary)}</strong>
            <p>
              {listing.seller.locationCity ?? dictionary.listings.locationNotProvided}
              {listing.favoriteCount > 0 ? ` · ${listing.favoriteCount} favori` : ""}
            </p>
          </div>

          <p className="listing-detail-p0-description">
            {listing.description?.trim() || dictionary.listings.noDescription}
          </p>

          <dl className="listing-detail-p0-facts">
            <div>
              <dt>Kategori</dt>
              <dd>{categoryName}</dd>
            </div>
            <div>
              <dt>Tip</dt>
              <dd>{listingType}</dd>
            </div>
            <div>
              <dt>Durum</dt>
              <dd>{condition}</dd>
            </div>
            <div>
              <dt>İlan</dt>
              <dd>{listingStatus}</dd>
            </div>
          </dl>

          {isOwner ? (
            <OwnerListingActions />
          ) : null}

          {currentUser.status === "checking" ? (
            <p className="listing-detail-p0-note">Aksiyonlar hazırlanıyor.</p>
          ) : null}

          {currentUser.status === "error" ? (
            <p className="listing-detail-p0-note">Hesap bilgisi şu an kontrol edilemedi.</p>
          ) : null}

          {canShowBuyerActions ? (
            <div className="listing-detail-p0-actions">
              <div className="listing-detail-p0-primary-actions">
                <MessageSellerButton
                  apiBaseUrl={apiBaseUrl}
                  categoryId={listing.category.id}
                  listingId={listing.id}
                  sellerProfileId={listing.seller.id}
                />

                {canAddToCart ? (
                  <AddToCartButton
                    apiBaseUrl={apiBaseUrl}
                    isAuthenticated={currentUser.status === "known"}
                    listingId={listing.id}
                  />
                ) : null}

                <FavoriteButton
                  apiBaseUrl={apiBaseUrl}
                  initiallyFavorited={false}
                  listingId={listing.id}
                />
              </div>

              <SellerCard listing={listing} />

              <details className="listing-detail-p0-safety">
                <summary>Güvenlik / bildir</summary>
                <ReportAction
                  actionLabel={dictionary.safety.reportListing}
                  onSubmitReport={(payload) => reportListing(apiBaseUrl, listing.id, payload)}
                />
              </details>
            </div>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  );
}


export function ListingDetailUnavailable({ error }: { error: ApiError }) {
  const { dictionary } = useI18n();

  return (
    <>
      <PageHeading
        eyebrow={dictionary.listings.detailEyebrow}
        title={dictionary.listings.detailUnavailableTitle}
        description={getApiErrorMessage(error, dictionary)}
      />
      <PageContainer>
        <Link className="primary-link" href="/browse">
          {dictionary.common.backToBrowse}
        </Link>
      </PageContainer>
    </>
  );
}

function ListingDetailGallery({
  apiBaseUrl,
  listing
}: {
  apiBaseUrl: string;
  listing: ListingDetailPayload["listing"];
}) {
  const galleryImages = listing.images;
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedImageFailed, setSelectedImageFailed] = useState(false);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [listing.id, galleryImages.length]);

  const selectedImage = galleryImages[selectedImageIndex] ?? galleryImages[0] ?? null;
  const selectedImageUrl = getSafeImageUrl(selectedImage?.url ?? null, apiBaseUrl);
  const hasMultipleImages = galleryImages.length > 1;
  const visibleSelectedImageUrl = selectedImageFailed ? null : selectedImageUrl;

  useEffect(() => {
    setSelectedImageFailed(false);
  }, [listing.id, selectedImageUrl]);

  function showPreviousImage() {
    if (!hasMultipleImages) {
      return;
    }

    setSelectedImageIndex((currentIndex) => (
      currentIndex - 1 + galleryImages.length
    ) % galleryImages.length);
  }

  function showNextImage() {
    if (!hasMultipleImages) {
      return;
    }

    setSelectedImageIndex((currentIndex) => (currentIndex + 1) % galleryImages.length);
  }

  function handleGalleryKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!hasMultipleImages) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousImage();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextImage();
    }
  }

  return (
    <div
      className="grid gap-3"
      onKeyDown={handleGalleryKeyDown}
      tabIndex={hasMultipleImages ? 0 : undefined}
    >
      <div className="listing-detail-main-image relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-muted/20">
        {visibleSelectedImageUrl ? (
          <img
            alt={`Ürün görseli: ${listing.title}`}
            className="block h-full w-full object-cover"
            decoding="async"
            loading="eager"
            onError={() => setSelectedImageFailed(true)}
            src={visibleSelectedImageUrl}
          />
        ) : (
          <div
            className="listing-detail-image-fallback"
            role="img"
            aria-label="Ürün görseli yok"
          >
            <span>Ürün görseli yok</span>
            <small>Satıcı görseli kaldırmış veya görsel henüz yüklenemiyor.</small>
          </div>
        )}

        {hasMultipleImages ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border/80 bg-background/90 text-2xl font-black text-foreground shadow-sm backdrop-blur transition hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Önceki görsel"
              onClick={showPreviousImage}
            >
              ‹
            </button>

            <button
              type="button"
              className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border/80 bg-background/90 text-2xl font-black text-foreground shadow-sm backdrop-blur transition hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Sonraki görsel"
              onClick={showNextImage}
            >
              ›
            </button>

            <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-black text-foreground shadow-sm backdrop-blur">
              {selectedImageIndex + 1} / {galleryImages.length}
            </span>
          </>
        ) : null}
      </div>

      {galleryImages.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {galleryImages.map((image, index) => {
            const imageUrl = getSafeImageUrl(image.url, apiBaseUrl);
            const isSelected = index === selectedImageIndex;

            return (
              <button
                type="button"
                className={`grid aspect-square place-items-center overflow-hidden rounded-2xl border bg-muted/30 transition focus:outline-none focus:ring-2 focus:ring-primary ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/25"
                    : "border-border/70 hover:border-primary/60"
                }`}
                key={image.id}
                aria-label={`${listing.title} görseli ${index + 1}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedImageIndex(index)}
              >
                <ListingDetailThumbnail imageUrl={imageUrl} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ListingDetailThumbnail({ imageUrl }: { imageUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (!imageUrl || imageFailed) {
    return <span className="listing-detail-thumbnail-fallback">Görsel yok</span>;
  }

  return (
    <img
      alt=""
      className="block h-full w-full object-cover"
      decoding="async"
      loading="lazy"
      onError={() => setImageFailed(true)}
      src={imageUrl}
    />
  );
}

function OwnerListingActions() {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
        href="/my-listings"
      >
        Düzenle
      </Link>
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-black text-secondary-foreground"
        href="/my-listings"
      >
        İlanlarım
      </Link>
    </div>
  );
}

function SellerCard({ listing }: { listing: ListingDetailPayload["listing"] }) {
  const { dictionary } = useI18n();
  const avatarUrl = getSafeImageUrl(listing.seller.avatarUrl, undefined);

  return (
    <section
      className="mt-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3"
      aria-label={dictionary.listings.sellerInformationAriaLabel}
    >
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-base font-black text-primary" aria-hidden="true">
        {avatarUrl ? (
          <img className="h-full w-full object-cover" src={avatarUrl} alt="" />
        ) : (
          <span>{listing.seller.displayName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="listing-meta">{dictionary.listings.seller}</p>
        <h2 className="truncate text-base font-black text-foreground">{listing.seller.displayName}</h2>
        <p className="text-sm font-semibold text-muted-foreground">
          {listing.seller.locationCity ?? dictionary.listings.locationNotProvided}
        </p>
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          Mesajlaşma BabyLoop üzerinden yapılır.
        </p>
      </div>
    </section>
  );
}

function BackArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </svg>
  );
}

function getSafeImageUrl(url: string | null, apiBaseUrl: string | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("/api/v1/uploads/") && apiBaseUrl) {
    return `${apiBaseUrl}${url}`;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function ImageReviewNotice({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(new URLSearchParams(window.location.search).get("imageReview") === "needs_review");
  }, []);

  if (!isVisible) {
    return null;
  }

  return <Alert title={title} message={message} />;
}
