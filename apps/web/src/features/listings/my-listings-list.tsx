"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type MyListingsListProps = {
  apiBaseUrl: string;
};

type EditDraft = {
  title: string;
  priceAmount: string;
  currency: string;
};

type ListingStatusFilter = "all" | ListingLifecycleStatus;

const STATUS_FILTERS: ListingStatusFilter[] = ["all", "active", "reserved", "sold", "archived"];

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
  const filteredListings = useMemo(
    () =>
      statusFilter === "all"
        ? listings
        : listings.filter((listing) => listing.status === statusFilter),
    [listings, statusFilter]
  );

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

    if (!title || !priceAmount) {
      setActionMessage(dictionary.listings.requiredFields);
      return;
    }

    setActionMessage(null);
    setPendingListingId(listingId);

    try {
      const body = await updateListingRequest(apiBaseUrl, listingId, {
        title,
        currency,
        priceAmount
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
        currency: listing.price?.currency ?? "TRY"
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
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value;

    setEditDrafts((currentDrafts) => ({
      ...currentDrafts,
      [listingId]: {
        title: currentDrafts[listingId]?.title ?? "",
        priceAmount: currentDrafts[listingId]?.priceAmount ?? "",
        currency: currentDrafts[listingId]?.currency ?? "TRY",
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
          currency: updatedListing.price?.currency ?? "TRY"
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
    <>
      <SellerListingsOverview metrics={listingMetrics} />

      <div className="seller-status-tabs" aria-label="Filter seller listings by status">
        {STATUS_FILTERS.map((status) => (
          <button
            aria-pressed={statusFilter === status}
            className={statusFilter === status ? "active" : ""}
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All" : formatListingStatus(status, dictionary)}
            <span>{getStatusCount(listingMetrics, status)}</span>
          </button>
        ))}
      </div>

      {actionMessage ? (
        <Alert title={dictionary.listings.lifecycleActionFailed} message={actionMessage} />
      ) : null}

      {filteredListings.length === 0 ? (
        <EmptyState
          title="No listings in this status"
          message="Switch status tabs or create a new listing to continue managing your seller workspace."
          actionHref="/sell"
          actionLabel={dictionary.listings.sellItem}
        />
      ) : null}

      <div className="listing-grid seller-management-grid">
        {filteredListings.map((listing) => {
          const isPending = pendingListingId === listing.id;
          const isEditing = editListingId === listing.id;
          const draft = editDrafts[listing.id] ?? {
            title: listing.title,
            priceAmount: listing.price?.amount ?? "",
            currency: listing.price?.currency ?? "TRY"
          };
          const isPublic = listing.status === "active" || listing.status === "reserved";

          return (
            <article className="listing-card seller-listing-card" key={listing.id}>
              <ListingImageFrame
                alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
                apiBaseUrl={apiBaseUrl}
                className="listing-card-image"
                fallbackLabel={dictionary.listings.noImage}
                url={listing.firstImage?.url ?? null}
              />

              <div className="listing-card-body">
                <div className="seller-listing-heading">
                  <div>
                    <p className="listing-meta">
                      {formatCategoryName(listing.category, dictionary)}
                    </p>
                    <h2>{listing.title}</h2>
                  </div>
                  <Badge tone={getListingStatusTone(listing.status)}>
                    {formatListingStatus(listing.status, dictionary)}
                  </Badge>
                </div>

                <dl className="seller-listing-facts">
                  <div>
                    <dt>Price</dt>
                    <dd>{formatListingPrice(listing.price, dictionary)}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{formatListingType(listing.listingType, dictionary)}</dd>
                  </div>
                  <div>
                    <dt>Condition</dt>
                    <dd>{formatListingCondition(listing.condition, dictionary)}</dd>
                  </div>
                  <div>
                    <dt>Favorites</dt>
                    <dd>{listing.favoriteCount}</dd>
                  </div>
                </dl>

                <div className={`seller-visibility-note${isPublic ? "" : " muted-state"}`}>
                  <strong>{isPublic ? "Public buyer view is available" : "Not public for buyers"}</strong>
                  <span>
                    {isPublic
                      ? "Review this page after price, title, photo, or status changes."
                      : "Reactivate only when the item is actually available again."}
                  </span>
                </div>

                {isEditing ? (
                  <form
                    className="listing-inline-form seller-inline-edit"
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

                <section className="seller-management-actions" aria-label={dictionary.listings.lifecycleActionsAriaLabel}>
                  <div>
                    <p className="listing-meta">Media</p>
                    <div className="listing-card-actions">
                      <label className="file-upload-label file-upload-label-inline">
                        <span>{isPending ? dictionary.listings.uploading : dictionary.listings.uploadImage}</span>
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isPending}
                          type="file"
                          onChange={(event) => {
                            void handleImageUpload(listing.id, event);
                          }}
                        />
                      </label>

                      {listing.firstImage ? (
                        <Button
                          variant="ghost"
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            void handleImageDelete(listing.id, listing.firstImage!.id);
                          }}
                        >
                          {dictionary.listings.deleteImage}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="listing-meta">Listing controls</p>
                    <div className="listing-card-actions">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={isPending}
                        onClick={() => startEditing(listing)}
                      >
                        {dictionary.listings.editListing}
                      </Button>

                      {getStatusActions(listing.status).map((status) => (
                        <Button
                          key={status}
                          variant="secondary"
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            void handleStatusChange(listing.id, status);
                          }}
                        >
                          {getStatusActionLabel(status, dictionary)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="seller-listing-footer">
                  <Link href="/account/seller">Seller insights</Link>
                  <Link href={`/categories/${listing.category.slug}`}>Compare category</Link>
                  {isPublic ? (
                    <Link href={`/listings/${listing.id}`}>{dictionary.common.viewDetails}</Link>
                  ) : (
                    <span className="muted">{dictionary.listings.notPublic}</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function SellerListingsOverview({
  metrics
}: {
  metrics: Record<ListingLifecycleStatus, number> & { total: number };
}) {
  return (
    <section className="seller-listings-overview" aria-label="Seller listing status summary">
      <div>
        <p className="eyebrow">Listing operations</p>
        <h2>Your seller workspace at a glance</h2>
        <p>
          Keep availability current. Buyers should only see active or reserved listings that can still lead to a useful conversation.
        </p>
      </div>

      <div className="seller-listings-metrics">
        <MetricCard label="Total" value={metrics.total} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Reserved" value={metrics.reserved} />
        <MetricCard label="Sold" value={metrics.sold} />
        <MetricCard label="Archived" value={metrics.archived} />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="seller-listings-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  return status === "all" ? metrics.total : metrics[status];
}

function isListingLifecycleStatus(status: string): status is ListingLifecycleStatus {
  return ["active", "reserved", "sold", "archived"].includes(status);
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
  status: ListingLifecycleStatus,
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  const labels = {
    active: dictionary.listings.reactivateListing,
    reserved: dictionary.listings.markReserved,
    sold: dictionary.listings.markSold,
    archived: dictionary.listings.archiveListing
  };

  return labels[status];
}
