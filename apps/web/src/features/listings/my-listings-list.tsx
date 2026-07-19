"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Alert, Badge, Button, EmptyState, LoadingBlock } from "../../components/ui";
import type { ListingSummary } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  deleteListingImageRequest,
  fetchMyListings,
  updateListingRequest,
  updateListingStatusRequest,
  uploadListingImageRequest,
  type ListingLifecycleStatus
} from "./api";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
  formatListingType
} from "./listing-display";
import { ListingImageFrame } from "./listing-image-frame";
import {
  formatListingAgeRange,
  listingAgeRangeOptions,
  parseListingAgeRangeFormValue,
  toListingAgeRangeFormValue
} from "./listing-age-range";
import {
  getListingPublicationDisplay,
  hasPendingListingPublication,
} from "./listing-publication-display";
import { PublicationWaitIndicator } from "./publication-wait-indicator";

type MyListingsListProps = {
  apiBaseUrl: string;
};

type EditDraft = {
  title: string;
  priceAmount: string;
  currency: string;
  recommendedAgeRange: string;
};

type ListingStatusFilter = "all" | "completed" | ListingLifecycleStatus;

type ListingActionMenuItem = {
  status: ListingLifecycleStatus;
  label: string;
};

const STATUS_FILTERS: Exclude<ListingStatusFilter, "all" | "sold" | "archived">[] = [
  "draft",
  "active",
  "reserved",
  "completed"
];
const BABYLOOP_MY_LISTINGS_DASHBOARD_OVERLAY_V1 = true;

export function MyListingsList({ apiBaseUrl }: MyListingsListProps) {
  const { dictionary } = useI18n();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [editListingId, setEditListingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ListingStatusFilter>("all");
  const [openMenuListingId, setOpenMenuListingId] = useState<string | null>(null);
  const [showPublicationConfirmation, setShowPublicationConfirmation] = useState(false);

  const clearProtectedState = useCallback(() => {
    setListings([]);
    setMessage(null);
    setActionMessage(null);
    setEditListingId(null);
    setEditDrafts({});
    setPendingListingId(null);
    setIsLoading(false);
  }, []);

  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadListings() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchMyListings(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setListings(body.data.listings);
      } catch {
        if (isActive) {
          setMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadListings();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, requireAuth]);

  const listingMetrics = useMemo(() => buildListingMetrics(listings), [listings]);
  const filteredListings = useMemo(() => {
    if (statusFilter === "all") {
      return listings;
    }

    if (statusFilter === "completed") {
      return listings.filter(
        (listing) => listing.status === "sold" || listing.status === "archived"
      );
    }

    return listings.filter((listing) => listing.status === statusFilter);
  }, [listings, statusFilter]);
  const hasPendingPublication = useMemo(
    () => hasPendingListingPublication(listings),
    [listings]
  );

  useEffect(() => {
    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.get("publication") !== "review") {
      return;
    }

    setShowPublicationConfirmation(true);
    currentUrl.searchParams.delete("publication");
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  }, []);

  useEffect(() => {
    if (!isLoading && showPublicationConfirmation && !hasPendingPublication) {
      setShowPublicationConfirmation(false);
    }
  }, [hasPendingPublication, isLoading, showPublicationConfirmation]);

  useEffect(() => {
    if (!hasPendingPublication) {
      return;
    }

    let active = true;
    let refreshing = false;

    const timer = window.setInterval(() => {
      if (refreshing) {
        return;
      }

      refreshing = true;
      void fetchMyListings(apiBaseUrl)
        .then((body) => {
          if (active && body.ok) {
            setListings(body.data.listings);
          }
        })
        .finally(() => {
          refreshing = false;
        });
    }, 7_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [apiBaseUrl, hasPendingPublication]);

  async function handleStatusChange(listingId: string, status: ListingLifecycleStatus) {
    if (!(await requireAuth())) {
      return;
    }

    setActionMessage(null);
    setPendingListingId(listingId);

    try {
      const body = await updateListingStatusRequest(apiBaseUrl, listingId, status);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      replaceListing(body.data.listing);
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingListingId(null);
    }
  }

  async function refreshListings() {
    const body = await fetchMyListings(apiBaseUrl);

    if (!body.ok) {
      setActionMessage(getApiErrorMessage(body.error, dictionary));
      return;
    }

    setListings(body.data.listings);
  }

  async function handleImageUpload(listingId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !(await requireAuth())) {
      return;
    }

    setActionMessage(null);
    setPendingListingId(listingId);

    try {
      const body = await uploadListingImageRequest(apiBaseUrl, listingId, file);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary, dictionary.listings.imageUploadFailed));
        return;
      }

      if (body.data.image.reviewStatus === "needs_review") {
        setActionMessage(dictionary.listings.imageNeedsReviewBody);
      }

      await refreshListings();
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleImageDelete(listingId: string, imageId: string) {
    if (!(await requireAuth())) {
      return;
    }

    setActionMessage(null);
    setPendingListingId(listingId);

    try {
      const body = await deleteListingImageRequest(apiBaseUrl, listingId, imageId);

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      await refreshListings();
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleEditSubmit(
    listingId: string,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!(await requireAuth())) {
      return;
    }

    const draft = editDrafts[listingId];

    if (!draft) {
      setActionMessage(dictionary.common.apiUnavailable);
      return;
    }

    const title = draft.title.trim();
    const priceAmount = draft.priceAmount.trim();
    const currency = draft.currency.trim().toUpperCase() || "TRY";
    const recommendedAgeRange = parseListingAgeRangeFormValue(draft.recommendedAgeRange);

    if (!title || !priceAmount || !recommendedAgeRange) {
      setActionMessage(dictionary.listings.requiredFields);
      return;
    }

    setActionMessage(null);
    setPendingListingId(listingId);

    try {
      const body = await updateListingRequest(apiBaseUrl, listingId, {
        title,
        currency,
        priceAmount,
        recommendedAgeMinMonths: recommendedAgeRange.minMonths,
        recommendedAgeMaxMonths: recommendedAgeRange.maxMonths
      });

      if (!body.ok) {
        setActionMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      replaceListing(body.data.listing);
      setEditListingId(null);
      setEditDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[listingId];
        return nextDrafts;
      });
    } catch {
      setActionMessage(dictionary.common.apiUnavailable);
    } finally {
      setPendingListingId(null);
    }
  }

  function startEditing(listing: ListingSummary) {
    setActionMessage(null);
    setOpenMenuListingId(null);
    setEditListingId((currentEditingId) => {
      if (currentEditingId === listing.id) {
        return null;
      }

      return listing.id;
    });

    setEditDrafts((currentDrafts) => ({
      ...currentDrafts,
      [listing.id]: {
        title: listing.title,
        priceAmount: listing.price?.amount ?? "",
        currency: listing.price?.currency ?? "TRY",
        recommendedAgeRange: toListingAgeRangeFormValue(
          listing.recommendedAgeMinMonths,
          listing.recommendedAgeMaxMonths
        )
      }
    }));
  }

  function cancelEditing(listingId: string) {
    setEditListingId(null);
    setActionMessage(null);
    setEditDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[listingId];
      return nextDrafts;
    });
  }

  function updateEditDraft(
    listingId: string,
    field: keyof EditDraft,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const value = event.target.value;

    setEditDrafts((currentDrafts) => ({
      ...currentDrafts,
      [listingId]: {
        title: currentDrafts[listingId]?.title ?? "",
        priceAmount: currentDrafts[listingId]?.priceAmount ?? "",
        currency: currentDrafts[listingId]?.currency ?? "TRY",
        recommendedAgeRange:
          currentDrafts[listingId]?.recommendedAgeRange ?? "independent",
        [field]: value
      }
    }));
  }

  function replaceListing(updatedListing: ListingSummary) {
    setListings((currentListings) =>
      currentListings.map((listing) =>
        listing.id === updatedListing.id ? updatedListing : listing
      )
    );

    setEditDrafts((currentDrafts) => {
      if (!currentDrafts[updatedListing.id]) {
        return currentDrafts;
      }

      return {
        ...currentDrafts,
        [updatedListing.id]: {
          title: updatedListing.title,
          priceAmount: updatedListing.price?.amount ?? "",
          currency: updatedListing.price?.currency ?? "TRY",
          recommendedAgeRange: toListingAgeRangeFormValue(
            updatedListing.recommendedAgeMinMonths,
            updatedListing.recommendedAgeMaxMonths
          )
        }
      };
    });
  }

  if (isCheckingAuth || isLoading) {
    return <LoadingBlock title={dictionary.listings.loadingMyListings} />;
  }

  if (message) {
    return (
      <EmptyState
        title={dictionary.listings.myListingsUnavailable}
        message={message}
        actionHref="/login"
        actionLabel={dictionary.common.login}
      />
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        title={dictionary.listings.noListingsTitle}
        message={dictionary.listings.noListingsBody}
        actionHref="/sell"
        actionLabel={dictionary.listings.sellItem}
      />
    );
  }

  return (
    <section className="grid gap-4" aria-label="İlan yönetimi">
      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">İlanlarım</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {statusFilter === "all"
              ? `${listingMetrics.total} ilan bulunuyor.`
              : `${filteredListings.length} ilan gösteriliyor.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter !== "all" ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-black text-foreground transition hover:bg-muted"
              data-status-filter="all"
              type="button"
              onClick={() => {
                setOpenMenuListingId(null);
                setEditListingId(null);
                setStatusFilter("all");
              }}
            >
              Tümünü göster
            </button>
          ) : null}
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
            href="/sell"
          >
            Yeni ilan ver
          </Link>
        </div>
      </div>

      <nav
        aria-label="İlan durumu"
        className="my-listings-status-grid grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status;

          return (
            <button
              aria-pressed={isActive}
              className={[
                "my-listings-status-card min-w-0 rounded-[1.25rem] border p-4 text-left transition",
                isActive
                  ? "border-primary/45 bg-primary/10 text-primary shadow-sm"
                  : "border-border/70 bg-background text-foreground hover:border-primary/30 hover:bg-primary/[0.04]"
              ].join(" ")}
              data-status-filter={status}
              key={status}
              type="button"
              onClick={() => {
                setOpenMenuListingId(null);
                setEditListingId(null);
                setStatusFilter(status);
              }}
            >
              <span className="block text-sm font-black">
                {getStatusFilterLabel(status, dictionary)}
              </span>
              <strong className="mt-2 block text-3xl font-black leading-none">
                {getStatusCount(listingMetrics, status)}
              </strong>
              <small className="mt-2 block text-xs font-bold text-muted-foreground">
                {isActive ? "Seçili filtre" : "İlanları göster"}
              </small>
            </button>
          );
        })}
      </nav>

      {showPublicationConfirmation ? (
        <div
          className="flex items-center gap-3 rounded-[1.25rem] border border-amber-300/55 bg-amber-50/80 p-4"
          role="status"
        >
          <PublicationWaitIndicator />
          <strong className="text-sm font-black text-foreground">İlanın onay sürecinde</strong>
        </div>
      ) : null}

      {actionMessage ? (
        <Alert title={dictionary.listings.lifecycleActionFailed} message={actionMessage} />
      ) : null}

      {filteredListings.length === 0 ? (
        <EmptyState
          title="Bu durumda ilan yok"
          message="Başka bir durum seçebilir veya yeni ilan oluşturabilirsin."
          actionHref="/sell"
          actionLabel={dictionary.listings.sellItem}
        />
      ) : null}

      <div className="listing-grid items-stretch">
        {filteredListings.map((listing) => {
          const isPending = pendingListingId === listing.id;
          const isEditing = editListingId === listing.id;
          const draft = editDrafts[listing.id] ?? {
            title: listing.title,
            priceAmount: listing.price?.amount ?? "",
            currency: listing.price?.currency ?? "TRY",
            recommendedAgeRange: toListingAgeRangeFormValue(
              listing.recommendedAgeMinMonths,
              listing.recommendedAgeMaxMonths
            )
          };
          const publicationDisplay = getListingPublicationDisplay(listing);
          const isPublic =
            (listing.status === "active" || listing.status === "reserved") &&
            listing.publicationState === "published";
          const firstImageId = listing.firstImage?.id ?? null;

          return (
            <article
              aria-label={`İlan: ${listing.title}`}
              className="my-listing-card listing-card relative overflow-hidden"
              data-listing-id={listing.id}
              data-listing-status={listing.status}
              data-listing-publication-state={listing.publicationState}
              key={listing.id}
            >
              {isPublic ? (
                <Link
                  aria-label={`${listing.title} ilanını aç`}
                  className="my-listing-detail-link block"
                  href={`/listings/${listing.id}`}
                >
                  <ListingImageFrame
                    alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
                    apiBaseUrl={apiBaseUrl}
                    className="listing-card-image"
                    fallbackLabel={dictionary.listings.noImage}
                    url={listing.firstImage?.url ?? null}
                  />
                </Link>
              ) : (
                <ListingImageFrame
                  alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
                  apiBaseUrl={apiBaseUrl}
                  className="listing-card-image"
                  fallbackLabel={dictionary.listings.noImage}
                  url={listing.firstImage?.url ?? null}
                />
              )}

              <div className="listing-card-body gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="listing-meta truncate">
                      {formatCategoryName(listing.category, dictionary)}
                    </p>
                    {isPublic ? (
                      <Link
                        className="my-listing-title-link block"
                        href={`/listings/${listing.id}`}
                      >
                        <h2 className="line-clamp-2 text-lg font-black leading-snug">{listing.title}</h2>
                      </Link>
                    ) : (
                      <h2 className="line-clamp-2 text-lg font-black leading-snug">{listing.title}</h2>
                    )}
                    <p className="mt-2 text-xl font-black text-foreground">
                      {formatListingPrice(listing.price, dictionary)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {publicationDisplay.isPending ? (
                      <PublicationWaitIndicator label={publicationDisplay.tooltip ?? "Onay bekliyor"} />
                    ) : null}
                    <Badge tone={getListingStatusTone(listing.status)}>
                      <span data-listing-status-label={listing.status}>
                        {formatListingStatus(listing.status, dictionary)}
                      </span>
                    </Badge>
                  </div>
                </div>

                <p className="text-sm font-semibold leading-6 text-muted-foreground">
                  Durum: {formatListingCondition(listing.condition, dictionary)} · Favori:{" "}
                  {listing.favoriteCount} · Tip: {formatListingType(listing.listingType, dictionary)}
                </p>
                <p className="text-xs font-bold text-muted-foreground">
                  Önerilen yaş: {formatListingAgeRange(
                    listing.recommendedAgeMinMonths,
                    listing.recommendedAgeMaxMonths
                  )}
                </p>

                {publicationDisplay.title ? (
                  <div
                    className={[
                      "flex items-center gap-3 rounded-2xl border px-3 py-3",
                      publicationDisplay.needsAttention
                        ? "border-destructive/25 bg-destructive/10"
                        : "border-amber-300/55 bg-amber-50/80",
                    ].join(" ")}
                    data-listing-publication-message={listing.publicationState}
                  >
                    {publicationDisplay.isPending ? (
                      <PublicationWaitIndicator label={publicationDisplay.tooltip ?? "Onay bekliyor"} />
                    ) : null}
                    <div>
                      <strong className="block text-sm font-black text-foreground">
                        {publicationDisplay.title}
                      </strong>
                      {publicationDisplay.message ? (
                        <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                          {publicationDisplay.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {isEditing ? (
                  <form
                    aria-label={`${listing.title} ilanını düzenle`}
                    aria-modal="true"
                    className="my-listing-edit-modal listing-inline-form rounded-[1.25rem] border border-border bg-background p-4"
                    role="dialog"
                    onSubmit={(event) => {
                      void handleEditSubmit(listing.id, event);
                    }}
                  >
                    <label>
                      <span>{dictionary.listings.title}</span>
                      <input
                        name="title"
                        type="text"
                        minLength={4}
                        maxLength={160}
                        value={draft.title}
                        disabled={isPending}
                        required
                        onChange={(event) => updateEditDraft(listing.id, "title", event)}
                      />
                    </label>

                    <label>
                      <span>{dictionary.listings.priceAmount}</span>
                      <input
                        name="priceAmount"
                        type="text"
                        inputMode="decimal"
                        value={draft.priceAmount}
                        disabled={isPending}
                        required
                        onChange={(event) => updateEditDraft(listing.id, "priceAmount", event)}
                      />
                    </label>

                    <input
                      name="currency"
                      type="hidden"
                      value={draft.currency}
                      onChange={(event) => updateEditDraft(listing.id, "currency", event)}
                    />

                    <label>
                      <span>Önerilen yaş aralığı</span>
                      <select
                        name="recommendedAgeRange"
                        value={draft.recommendedAgeRange}
                        disabled={isPending}
                        onChange={(event) =>
                          updateEditDraft(listing.id, "recommendedAgeRange", event)
                        }
                      >
                        {!listingAgeRangeOptions.some(
                          (option) => option.value === draft.recommendedAgeRange
                        ) ? (
                          <option value={draft.recommendedAgeRange}>
                            {formatListingAgeRange(
                              listing.recommendedAgeMinMonths,
                              listing.recommendedAgeMaxMonths
                            )} (mevcut)
                          </option>
                        ) : null}
                        {listingAgeRangeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="listing-card-actions">
                      <Button type="submit" disabled={isPending}>
                        {isPending ? dictionary.listings.saving : dictionary.listings.saveChanges}
                      </Button>

                      <Button
                        variant="ghost"
                        type="button"
                        disabled={isPending}
                        onClick={() => cancelEditing(listing.id)}
                      >
                        {dictionary.listings.cancelEdit}
                      </Button>
                    </div>
                  </form>
                ) : null}

                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                  <Button
                    className="min-h-10 w-full px-3"
                    variant="secondary"
                    type="button"
                    disabled={isPending}
                    onClick={() => startEditing(listing)}
                  >
                    {dictionary.listings.editListing}
                  </Button>

                  <MyListingActionsMenu
                    listingId={listing.id}
                    actions={getStatusActions(listing.status).map((status) => ({
                      status,
                      label: getStatusActionLabel(listing.status, status, dictionary)
                    }))}
                    hasImage={Boolean(listing.firstImage)}
                    isOpen={openMenuListingId === listing.id}
                    isPending={isPending}
                    onImageDelete={
                      firstImageId
                        ? () => {
                            void handleImageDelete(listing.id, firstImageId);
                          }
                        : null
                    }
                    onImageUpload={(event) => {
                      void handleImageUpload(listing.id, event);
                    }}
                    onOpenChange={(isOpen) => {
                      if (isOpen) {
                        setEditListingId(null);
                      }

                      setOpenMenuListingId(isOpen ? listing.id : null);
                    }}
                    onStatusChange={(status) => {
                      void handleStatusChange(listing.id, status);
                    }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MyListingActionsMenu({
  actions,
  listingId,
  hasImage,
  isOpen,
  isPending,
  onImageDelete,
  onImageUpload,
  onOpenChange,
  onStatusChange
}: {
  actions: ListingActionMenuItem[];
  listingId: string;
  hasImage: boolean;
  isOpen: boolean;
  isPending: boolean;
  onImageDelete: (() => void) | null;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenChange: (isOpen: boolean) => void;
  onStatusChange: (status: ListingLifecycleStatus) => void;
}) {
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <>
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-black text-foreground transition hover:bg-muted disabled:opacity-55"
        data-listing-status-menu-trigger={listingId}
        disabled={isPending}
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(!isOpen);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          onOpenChange(!isOpen);
        }}
      >
        İşlemler
      </button>

      {isOpen ? (
        <div
          className="my-listing-actions-layer"
          data-listing-card-overlay="actions"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
        >
          <div
            aria-label="İlan işlemleri"
            className="my-listing-actions-menu rounded-2xl border border-border bg-background p-2 shadow-xl"
            data-listing-status-menu={listingId}
            id={menuId}
            role="menu"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-2 pb-2">
              <strong className="text-sm font-black text-foreground">İlan işlemleri</strong>
              <button
                aria-label="İlan işlemlerini kapat"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-lg font-black text-foreground hover:bg-muted"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                ×
              </button>
            </div>

            <label
              className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted focus-within:bg-muted"
              role="menuitem"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                event.currentTarget.querySelector("input")?.click();
              }}
            >
              <span className="truncate">{isPending ? "Yükleniyor" : "Görseli yönet"}</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={isPending}
                type="file"
                onChange={(event) => {
                  onImageUpload(event);
                  onOpenChange(false);
                }}
              />
            </label>

            {hasImage && onImageDelete ? (
              <button
                className="flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-55"
                disabled={isPending}
                role="menuitem"
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onImageDelete();
                }}
              >
                Görseli sil
              </button>
            ) : null}

            {actions.length > 0 ? (
              <div className="my-1 border-t border-border/70" role="separator" />
            ) : null}

            {actions.map((action) => (
              <button
                className="flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-55"
                data-listing-status-action={action.status}
                disabled={isPending}
                key={action.status}
                role="menuitem"
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onStatusChange(action.status);
                }}
              >
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function buildListingMetrics(listings: ListingSummary[]): Record<ListingLifecycleStatus, number> & { total: number } {
  return listings.reduce(
    (metrics, listing) => {
      if (isListingLifecycleStatus(listing.status)) {
        metrics[listing.status] += 1;
      }

      return metrics;
    },
    {
      total: listings.length,
      draft: 0,
      active: 0,
      reserved: 0,
      sold: 0,
      archived: 0
    }
  );
}

function getStatusCount(
  metrics: Record<ListingLifecycleStatus, number> & { total: number },
  status: ListingStatusFilter
): number {
  if (status === "all") {
    return metrics.total;
  }

  if (status === "completed") {
    return metrics.sold + metrics.archived;
  }

  return metrics[status];
}

function getStatusFilterLabel(
  status: ListingStatusFilter,
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  if (status === "all") {
    return "Tüm ilanlar";
  }

  if (status === "draft") {
    return "Yayında değil";
  }

  if (status === "active") {
    return "Yayında";
  }

  if (status === "reserved") {
    return "Rezerve";
  }

  if (status === "completed") {
    return "Tamamlanan";
  }

  if (status === "sold") {
    return "Satıldı";
  }

  return formatListingStatus(status, dictionary);
}

function isListingLifecycleStatus(status: string): status is ListingLifecycleStatus {
  return ["draft", "active", "reserved", "sold", "archived"].includes(status);
}

function getListingStatusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "active") {
    return "success";
  }

  if (status === "reserved") {
    return "warning";
  }

  return "neutral";
}

function getStatusActions(status: string): ListingLifecycleStatus[] {
  if (status === "draft") {
    return ["active"];
  }

  if (status === "active") {
    return ["reserved", "sold", "archived"];
  }

  if (status === "reserved") {
    return ["active", "sold", "archived"];
  }

  if (status === "archived") {
    return ["active"];
  }

  if (status === "sold") {
    return ["archived"];
  }

  return [];
}

function getStatusActionLabel(
  currentStatus: string,
  status: ListingLifecycleStatus,
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  if (status === "active" && (currentStatus === "draft" || currentStatus === "archived")) {
    return "Yeniden onaya gönder";
  }

  const labels = {
    draft: dictionary.listings.reactivateListing,
    active: dictionary.listings.reactivateListing,
    reserved: dictionary.listings.markReserved,
    sold: dictionary.listings.markSold,
    archived: dictionary.listings.archiveListing
  };

  return labels[status];
}
