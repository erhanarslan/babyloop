"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  EmptyState,
  PageContainer,
  PageHeading
} from "../../components/ui";
import { FavoriteButton } from "../../features/favorites/favorite-button";
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
import {
  formatCategoryName,
  formatDateTime,
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
  const { dictionary, locale } = useI18n();
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

  return (
    <PageContainer className="grid gap-5 pb-12 pt-5 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,760px)_420px]">
      {!isOwner && currentUser.status !== "checking" ? <RecentlyViewedTracker listing={listing} /> : null}

      <section className="min-w-0" aria-label={dictionary.listings.imageGalleryAriaLabel}>
        <ListingDetailGallery
          apiBaseUrl={apiBaseUrl}
          listing={listing}
        />
      </section>

      <article className="self-start rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm sm:p-5 lg:sticky lg:top-28">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link className="text-sm font-black text-primary hover:underline" href="/browse">
            {dictionary.common.backToBrowse}
          </Link>
          {isOwner ? <Badge tone="success">Bu senin ilanın</Badge> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>{categoryName}</Badge>
          <Badge>{listingType}</Badge>
          <Badge>{condition}</Badge>
          <Badge tone={listing.status === "reserved" ? "warning" : "success"}>{listingStatus}</Badge>
        </div>

        <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          {listing.title}
        </h1>
        <p className="mt-3 text-3xl font-black text-foreground">
          {formatListingPrice(listing.price, dictionary)}
        </p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          {listing.favoriteCount} favori · {listing.seller.locationCity ?? "Şehir belirtilmedi"} ·{" "}
          {formatDateTime(listing.createdAt, locale)}
        </p>

        <div className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <h2 className="text-sm font-black text-foreground">Açıklama</h2>
          <p className="mt-2 line-clamp-5 text-sm font-semibold leading-6 text-muted-foreground">
            {listing.description?.trim() || dictionary.listings.noDescription}
          </p>
        </div>

        <dl className="mt-4 grid gap-2 text-sm font-semibold text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <dt>Kategori</dt>
            <dd className="text-right text-foreground">{categoryName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Tip</dt>
            <dd className="text-right text-foreground">{listingType}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Durum</dt>
            <dd className="text-right text-foreground">{condition}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>İlan durumu</dt>
            <dd className="text-right text-foreground">{listingStatus}</dd>
          </div>
        </dl>

        {isOwner ? (
          <OwnerListingActions />
        ) : null}

        {currentUser.status === "checking" ? (
          <p className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm font-bold text-muted-foreground">
            Aksiyonlar hazırlanıyor.
          </p>
        ) : null}

        {currentUser.status === "error" ? (
          <p className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm font-bold text-muted-foreground">
            Hesap bilgisi şu an kontrol edilemedi.
          </p>
        ) : null}

        {canShowBuyerActions ? (
          <>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <MessageSellerButton
                apiBaseUrl={apiBaseUrl}
                categoryId={listing.category.id}
                listingId={listing.id}
                sellerProfileId={listing.seller.id}
              />
              <FavoriteButton
                apiBaseUrl={apiBaseUrl}
                initiallyFavorited={false}
                listingId={listing.id}
              />
            </div>

            <SellerCard listing={listing} />

            <details className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-black text-foreground">
                Güvenli alışveriş
              </summary>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                Ödeme ve teslim detaylarını BabyLoop mesajlaşmasında netleştir.
              </p>
              <div className="mt-3">
                <ReportAction
                  actionLabel={dictionary.safety.reportListing}
                  onSubmitReport={(payload) => reportListing(apiBaseUrl, listing.id, payload)}
                />
              </div>
            </details>
          </>
        ) : null}
      </article>
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
  const primaryImage = listing.images[0] ?? null;
  const primaryImageUrl = getSafeImageUrl(primaryImage?.url ?? null, apiBaseUrl);

  return (
    <div className="grid gap-3">
      <div className="grid aspect-[4/3] max-h-[560px] min-h-[260px] place-items-center overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/30">
        {primaryImageUrl ? (
          <img
            alt={`Ürün görseli: ${listing.title}`}
            className="h-full w-full object-contain"
            loading="eager"
            src={primaryImageUrl}
          />
        ) : (
          <span className="text-sm font-black text-muted-foreground">Ürün görseli yok</span>
        )}
      </div>

      {listing.images.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {listing.images.slice(0, 5).map((image, index) => {
            const imageUrl = getSafeImageUrl(image.url, apiBaseUrl);

            return (
              <div
                className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border/70 bg-muted/30"
                key={image.id}
              >
                {imageUrl ? (
                  <img
                    alt={`${listing.title} görseli ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={imageUrl}
                  />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">Görsel yok</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
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
