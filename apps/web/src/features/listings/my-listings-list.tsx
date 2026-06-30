"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type ListingActionMenuItem = {
  status: ListingLifecycleStatus;
  label: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const STATUS_FILTERS: ListingStatusFilter[] = ["all", "active", "reserved", "sold", "archived"];
const ACTION_MENU_WIDTH = 240;
const ACTION_MENU_MARGIN = 12;

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
    <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]" aria-label="İlan yönetimi">
      <aside className="self-start rounded-[1.25rem] border border-border/70 bg-muted/25 p-3">
        <nav aria-label="İlan durumu" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
          {STATUS_FILTERS.map((status) => (
            <button
              aria-pressed={statusFilter === status}
              className={[
                "min-w-[150px] rounded-2xl border px-3 py-2 text-left text-sm font-black transition lg:min-w-0",
                statusFilter === status
                  ? "border-primary/40 bg-background text-primary shadow-sm"
                  : "border-transparent text-foreground hover:bg-background/75"
              ].join(" ")}
              data-status-filter={status}
              key={status}
              type="button"
              onClick={() => {
                setOpenMenuListingId(null);
                setStatusFilter(status);
              }}
            >
              <span>{getStatusFilterLabel(status, dictionary)}</span>
              <small className="mt-1 block text-xs font-bold text-muted-foreground">
                {getStatusCount(listingMetrics, status)}
              </small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="grid min-w-0 gap-4">
        <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">İlanlarım</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {filteredListings.length} ilan gösteriliyor.
            </p>
          </div>
          <Link
            className="inline-flex rounded-full bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground"
            href="/sell"
          >
            Yeni ilan ver
          </Link>
        </div>

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
            currency: listing.price?.currency ?? "TRY"
          };
          const isPublic = listing.status === "active" || listing.status === "reserved";
          const firstImageId = listing.firstImage?.id ?? null;

          return (
            <article
              aria-label={`İlan: ${listing.title}`}
              className="listing-card relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[0.22rem] before:bg-gradient-to-r before:from-sky-500/85 before:to-emerald-500/80 before:content-['']"
              data-listing-id={listing.id}
              data-listing-status={listing.status}
              key={listing.id}
            >
              <ListingImageFrame
                alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
                apiBaseUrl={apiBaseUrl}
                className="listing-card-image"
                fallbackLabel={dictionary.listings.noImage}
                url={listing.firstImage?.url ?? null}
              />

              <div className="listing-card-body gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="listing-meta truncate">
                      {formatCategoryName(listing.category, dictionary)}
                    </p>
                    <h2 className="line-clamp-2 text-lg font-black leading-snug">{listing.title}</h2>
                    <p className="mt-2 text-xl font-black text-foreground">
                      {formatListingPrice(listing.price, dictionary)}
                    </p>
                  </div>
                  <Badge tone={getListingStatusTone(listing.status)}>
                    <span data-listing-status-label={listing.status}>
                      {formatListingStatus(listing.status, dictionary)}
                    </span>
                  </Badge>
                </div>

                <p className="text-sm font-semibold leading-6 text-muted-foreground">
                  Durum: {formatListingCondition(listing.condition, dictionary)} · Favori:{" "}
                  {listing.favoriteCount} · Tip: {formatListingType(listing.listingType, dictionary)}
                </p>

                {isEditing ? (
                  <form
                    className="listing-inline-form rounded-[1.25rem] border border-border bg-slate-50/90 p-4"
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

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <Button
                    className="min-h-10 flex-1 px-3"
                    variant="secondary"
                    type="button"
                    disabled={isPending}
                    onClick={() => startEditing(listing)}
                  >
                    {dictionary.listings.editListing}
                  </Button>
                  {isPublic ? (
                    <Link
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
                      href={`/listings/${listing.id}`}
                    >
                      {dictionary.common.viewDetails}
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-black text-muted-foreground">
                      {dictionary.listings.notPublic}
                    </span>
                  )}

                  <MyListingActionsMenu
                    listingId={listing.id}
                    actions={getStatusActions(listing.status).map((status) => ({
                      status,
                      label: getStatusActionLabel(status, dictionary)
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    setPosition(calculateActionMenuPosition(triggerRef.current));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const eventPath = event.composedPath();

      if (
        (triggerRef.current && eventPath.includes(triggerRef.current)) ||
        (menuRef.current && eventPath.includes(menuRef.current))
      ) {
        return;
      }

      onOpenChange(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    function closeForViewportChange() {
      onOpenChange(false);
    }

    function repositionForScroll() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeForViewportChange);
    window.addEventListener("scroll", repositionForScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeForViewportChange);
      window.removeEventListener("scroll", repositionForScroll, true);
    };
  }, [isOpen, onOpenChange, updatePosition]);

  const resolvedPosition =
    position ?? (isOpen && triggerRef.current ? calculateActionMenuPosition(triggerRef.current) : null);

  const menu =
    isOpen && resolvedPosition
      ? createPortal(
          <div
            className="fixed z-[80] max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl border border-border bg-background p-2 shadow-xl"
            data-listing-status-menu={listingId}
            id={menuId}
            ref={menuRef}
            role="menu"
            style={{
              left: resolvedPosition.left,
              top: resolvedPosition.top,
              width: resolvedPosition.width
            }}
          >
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
                disabled={isPending}
                key={action.status}
                data-listing-status-action={action.status}
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-listing-status-menu-trigger={listingId}
        className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-black text-foreground transition hover:bg-muted disabled:opacity-55 sm:w-auto"
        disabled={isPending}
        ref={triggerRef}
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!isOpen) {
            updatePosition();
          }

          onOpenChange(!isOpen);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();

          if (!isOpen) {
            updatePosition();
          }

          onOpenChange(!isOpen);
        }}
      >
        İşlemler
      </button>
      {menu}
    </>
  );
}

function calculateActionMenuPosition(trigger: HTMLButtonElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(
    ACTION_MENU_WIDTH,
    Math.max(160, viewportWidth - ACTION_MENU_MARGIN * 2)
  );
  const maxLeft = Math.max(ACTION_MENU_MARGIN, viewportWidth - width - ACTION_MENU_MARGIN);
  const left = clamp(rect.right - width, ACTION_MENU_MARGIN, maxLeft);

  const estimatedMenuHeight = Math.min(
    420,
    Math.max(220, viewportHeight * 0.7)
  );
  const preferredBelowTop = rect.bottom + ACTION_MENU_MARGIN / 2;
  const preferredAboveTop = rect.top - estimatedMenuHeight - ACTION_MENU_MARGIN / 2;
  const hasRoomBelow = preferredBelowTop + estimatedMenuHeight <= viewportHeight - ACTION_MENU_MARGIN;
  const hasRoomAbove = preferredAboveTop >= ACTION_MENU_MARGIN;

  const top = hasRoomBelow
    ? preferredBelowTop
    : hasRoomAbove
      ? preferredAboveTop
      : clamp(
          preferredBelowTop,
          ACTION_MENU_MARGIN,
          Math.max(ACTION_MENU_MARGIN, viewportHeight - estimatedMenuHeight - ACTION_MENU_MARGIN)
        );

  return {
    left,
    top,
    width
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

function getStatusFilterLabel(
  status: ListingStatusFilter,
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  if (status === "all") {
    return "Tüm ilanlar";
  }

  if (status === "active") {
    return "Aktif";
  }

  if (status === "reserved") {
    return "Rezerve";
  }

  if (status === "sold") {
    return "Satıldı";
  }

  return formatListingStatus(status, dictionary);
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
