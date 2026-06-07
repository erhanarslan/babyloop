"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, EmptyState, LoadingBlock } from "../../components/ui";
import type { ListingSummary } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  fetchMyListings,
  updateListingRequest,
  updateListingStatusRequest,
  type ListingLifecycleStatus
} from "./api";
import {
  formatCategoryName,
  formatListingPrice,
  formatListingStatus
} from "./listing-display";

type MyListingsListProps = {
  apiBaseUrl: string;
};

type EditDraft = {
  title: string;
  priceAmount: string;
  currency: string;
};

export function MyListingsList({ apiBaseUrl }: MyListingsListProps) {
  const { dictionary } = useI18n();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [editListingId, setEditListingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);

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
      {actionMessage ? (
        <Alert title={dictionary.listings.lifecycleActionFailed} message={actionMessage} />
      ) : null}

      <div className="listing-grid">
        {listings.map((listing) => {
          const isPending = pendingListingId === listing.id;
          const isEditing = editListingId === listing.id;
          const draft = editDrafts[listing.id] ?? {
            title: listing.title,
            priceAmount: listing.price?.amount ?? "",
            currency: listing.price?.currency ?? "TRY"
          };

          return (
            <article className="listing-card" key={listing.id}>
              <div className="listing-image" aria-label={`${listing.title} image preview`}>
                {listing.firstImage ? (
                  <span>{dictionary.listings.imageMetadata}</span>
                ) : (
                  <span>{dictionary.listings.noImage}</span>
                )}
              </div>

              <div className="listing-card-body">
                <div>
                  <p className="listing-meta">
                    {formatCategoryName(listing.category, dictionary)}
                  </p>
                  <h2>{listing.title}</h2>
                  <Badge tone={getListingStatusTone(listing.status)}>
                    {formatListingStatus(listing.status, dictionary)}
                  </Badge>
                  <p className="listing-meta">
                    {dictionary.listings.favoriteCount.replace("{count}", String(listing.favoriteCount))}
                  </p>
                </div>

                {isEditing ? (
                  <form
                    className="listing-inline-form"
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

                <div
                  className="listing-card-actions"
                  aria-label={dictionary.listings.lifecycleActionsAriaLabel}
                >
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

                <div className="listing-card-footer">
                  <strong>{formatListingPrice(listing.price, dictionary)}</strong>
                  {listing.status === "active" || listing.status === "reserved" ? (
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
