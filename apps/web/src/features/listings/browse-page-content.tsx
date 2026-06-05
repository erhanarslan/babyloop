"use client";

import Link from "next/link";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageContainer,
  PageHeading
} from "../../components/ui";
import type { Category, ListingSummary } from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ListingImageFrame } from "./listing-image-frame";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingType
} from "./listing-display";

type BrowsePageContentProps = {
  categories: Category[];
  error: ApiError | null;
  listings: ListingSummary[];
  searchQuery: string;
};

export function BrowsePageContent({
  categories,
  error,
  listings,
  searchQuery
}: BrowsePageContentProps) {
  const { dictionary } = useI18n();
  const hasSearchQuery = searchQuery.length >= 3;
  const title = hasSearchQuery
    ? dictionary.listings.browseResultsTitle.replace("{query}", searchQuery)
    : dictionary.listings.browseTitle;

  return (
    <>
      <PageHeading
        eyebrow={dictionary.listings.browseEyebrow}
        title={title}
        description={dictionary.listings.browseDescription}
      />

      <PageContainer className="browse-layout" ariaLabel={dictionary.listings.browseAriaLabel}>
        <Card as="aside" className="filter-panel" aria-label={dictionary.listings.categoriesAriaLabel}>
          <h2>{dictionary.listings.categoriesTitle}</h2>
          <p className="filter-note">{dictionary.listings.categoriesNote}</p>
          {categories.length > 0 ? (
            <ul className="category-list">
              {categories.map((category) => (
                <li key={category.id}>
                  <span>{formatCategoryName(category, dictionary)}</span>
                  <small>{category.slug}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{dictionary.listings.categoriesUnavailable}</p>
          )}
        </Card>

        <div className="listing-column">
          {error ? (
            <Alert
              title={dictionary.listings.listingsUnavailable}
              message={getApiErrorMessage(error, dictionary)}
            />
          ) : null}

          {!error && listings.length === 0 ? (
            <EmptyState
              title={dictionary.listings.noActiveListingsTitle}
              message={dictionary.listings.noActiveListingsBody}
            />
          ) : null}

          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function ListingCard({ listing }: { listing: ListingSummary }) {
  const { dictionary } = useI18n();

  return (
    <article className="listing-card">
      <ListingImageFrame
        alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
        className="listing-card-image"
        fallbackLabel={dictionary.listings.noProductImage}
        url={listing.firstImage?.url ?? null}
      />
      <div className="listing-card-body">
        <div>
          <div className="listing-card-badges">
            <Badge>{formatCategoryName(listing.category, dictionary)}</Badge>
            <Badge tone="success">
              {dictionary.listings.typeLabel}: {formatListingType(listing.listingType, dictionary)}
            </Badge>
          </div>
          <h2>{listing.title}</h2>
          <p className="muted">
            {dictionary.listings.conditionLabel}: {formatListingCondition(listing.condition, dictionary)}
          </p>
        </div>
        <div className="listing-card-footer">
          <strong>{formatListingPrice(listing.price, dictionary)}</strong>
          <Link href={`/listings/${listing.id}`}>{dictionary.common.viewDetails}</Link>
        </div>
      </div>
    </article>
  );
}
