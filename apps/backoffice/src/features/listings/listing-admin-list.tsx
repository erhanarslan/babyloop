"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminListingImageReviewStatus,
  type AdminListingSort,
  type AdminListingStatus,
  type AdminListingSummary,
  listAdminListings,
} from "./api";

type StatusFilter = AdminListingStatus | "all";
type ImageReviewStatusFilter = AdminListingImageReviewStatus | "all";

type FilterState = {
  status: StatusFilter;
  imageReviewStatus: ImageReviewStatusFilter;
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
  q: "",
  sort: "newest",
  limit: 50,
};

export function ListingAdminList() {
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [listings, setListings] = useState<AdminListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadListings() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await listAdminListings({
        ...(appliedFilters.status === "all"
          ? {}
          : { status: appliedFilters.status }),
        ...(appliedFilters.imageReviewStatus === "all"
          ? {}
          : { imageReviewStatus: appliedFilters.imageReviewStatus }),
        ...(appliedFilters.q.trim() ? { q: appliedFilters.q.trim() } : {}),
        sort: appliedFilters.sort,
        limit: appliedFilters.limit,
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setListings([]);
        setErrorMessage(getApiErrorMessage(response, "Could not load listings."));
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

  const loadedNeedsReviewCount = listings.filter(isListingAwaitingImageReview).length;
  const isImageReviewQueueActive = appliedFilters.imageReviewStatus === "needs_review";

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Marketplace operations</p>
          <h2>Listings</h2>
          <p>
            Review marketplace listings with privacy-safe seller summaries,
            image review state, AI authenticity signals, and related moderation case signals.
          </p>
        </div>
      </div>

      <div className="state-panel">
        <strong>{isImageReviewQueueActive ? "Image review queue active" : "Image review queue"}</strong>
        <p>
          Needs review images are hidden from public listing responses until an admin approves them.
          Loaded results awaiting image review: {loadedNeedsReviewCount}.
        </p>
        <div className="form-button-row">
          <button
            className="secondary-action"
            disabled={isLoading}
            onClick={() => {
              const nextFilters: FilterState = {
                ...draftFilters,
                imageReviewStatus: "needs_review",
                sort: "newest",
              };
              setDraftFilters(nextFilters);
              setAppliedFilters({
                ...nextFilters,
                q: nextFilters.q.trim(),
              });
            }}
            type="button"
          >
            Show review queue
          </button>
          <button
            className="secondary-action"
            disabled={isLoading || !isImageReviewQueueActive}
            onClick={resetFilters}
            type="button"
          >
            Clear queue filter
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
            <span>Status</span>
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
            <span>Image review</span>
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
            <span>Search</span>
            <input
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Listing, title, category, seller profile"
              type="search"
              value={draftFilters.q}
            />
          </label>

          <label className="form-field">
            <span>Sort</span>
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
                setDraftFilters((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                }))
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
            Apply filters
          </button>
          <button
            className="secondary-action"
            disabled={isLoading}
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>

      {isLoading ? <div className="state-panel">Loading listings...</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && listings.length === 0 ? (
        <div className="state-panel">
          <strong>No listings found</strong>
          <p>There are no marketplace listings matching this filter.</p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && listings.length > 0 ? (
        <div className="case-list">
          {listings.map((listing) => (
            <article className="case-card listing-admin-card" key={listing.id}>
              <div className="listing-admin-card-body">
                {listing.primaryImage ? (
                  <img
                    alt=""
                    className="listing-admin-thumbnail"
                    src={listing.primaryImage.url}
                  />
                ) : (
                  <div className="listing-admin-thumbnail placeholder">
                    No image
                  </div>
                )}

                <div>
                  <div className="case-card-header">
                    <span className={`status-badge ${listing.status}`}>
                      {getStatusLabel(listing.status)}
                    </span>
                    <span className="muted">{listing.category.name}</span>
                  </div>

                  <h3>{listing.title}</h3>
                  <p>{listing.description ?? "No description provided."}</p>

                  <dl className="compact-details">
                    <div>
                      <dt>Price</dt>
                      <dd>{formatPrice(listing)}</dd>
                    </div>
                    <div>
                      <dt>Seller</dt>
                      <dd>{listing.seller.displayName}</dd>
                    </div>
                    <div>
                      <dt>Images</dt>
                      <dd>{listing.imageCount}</dd>
                    </div>
                    <div>
                      <dt>Primary image</dt>
                      <dd>
                        {formatPrimaryImageReview(listing)}
                      </dd>
                    </div>
                    <div>
                      <dt>Open cases</dt>
                      <dd>{listing.moderation.openRelatedCaseCount}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDateTime(listing.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatDateTime(listing.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <Link className="secondary-action" href={`/listings/${listing.id}`}>
                {isListingAwaitingImageReview(listing) ? "Review images" : "Open listing"}
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getStatusLabel(status: StatusFilter): string {
  switch (status) {
    case "all":
      return "All";
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "reserved":
      return "Reserved";
    case "sold":
      return "Sold";
    case "archived":
      return "Archived";
  }
}

function getImageReviewStatusLabel(status: ImageReviewStatusFilter): string {
  switch (status) {
    case "all":
      return "All";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "needs_review":
      return "Needs review";
    case "rejected":
      return "Rejected";
  }
}

function getSortLabel(sort: AdminListingSort): string {
  switch (sort) {
    case "newest":
      return "Newest";
    case "oldest":
      return "Oldest";
    case "updated_desc":
      return "Recently updated";
    case "updated_asc":
      return "Least recently updated";
  }
}

function formatPrice(listing: AdminListingSummary): string {
  return listing.price
    ? `${listing.price.amount} ${listing.price.currency}`
    : "Not set";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.message ?? fallback;
}

function isListingAwaitingImageReview(listing: AdminListingSummary): boolean {
  return listing.primaryImage?.reviewStatus === "needs_review";
}

function formatPrimaryImageReview(listing: AdminListingSummary): string {
  if (!listing.primaryImage) {
    return "No image";
  }

  const reviewStatus = getImageReviewStatusLabel(listing.primaryImage.reviewStatus);
  const aiDecision = listing.primaryImage.authenticity.decision;

  return aiDecision ? `${reviewStatus} · AI ${aiDecision}` : reviewStatus;
}
