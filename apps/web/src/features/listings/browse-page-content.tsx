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
import type {
  BrowseListingsFilters,
  Category,
  ListingSummary,
  ListingsPagination
} from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ListingImageFrame } from "./listing-image-frame";
import { appendIfPresent } from "./browse-routing";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
  formatListingType
} from "./listing-display";

type BrowsePageContentProps = {
  apiBaseUrl: string;
  categories: Category[];
  currentCategorySlug: string | null;
  error: ApiError | null;
  filters: BrowseListingsFilters;
  listings: ListingSummary[];
  pagination: ListingsPagination;
  searchQuery: string;
};

type CategoryTreeNode = Category & {
  children: CategoryTreeNode[];
  depth: number;
};

const CONDITION_OPTIONS = ["new", "like_new", "good", "fair", "needs_repair"] as const;
const LISTING_TYPE_OPTIONS = ["sale", "swap", "donation"] as const;
const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Price low to high", value: "price_asc" },
  { label: "Price high to low", value: "price_desc" }
] as const;

export function BrowsePageContent({
  apiBaseUrl,
  categories,
  currentCategorySlug,
  error,
  filters,
  listings,
  pagination,
  searchQuery
}: BrowsePageContentProps) {
  const { dictionary } = useI18n();
  const categoryTree = buildCategoryTree(categories);
  const orderedCategories = flattenCategoryTree(categoryTree);
  const selectedCategory = categories.find((category) => category.id === filters.categoryId) ?? null;
  const hasSearchQuery = searchQuery.length >= 3;
  const title = hasSearchQuery
    ? dictionary.listings.browseResultsTitle.replace("{query}", searchQuery)
    : selectedCategory
      ? formatCategoryName(selectedCategory, dictionary)
      : dictionary.listings.browseTitle;
  const hasPreviousPage = pagination.offset > 0;
  const previousOffset = Math.max(0, pagination.offset - pagination.limit);
  const nextOffset = pagination.offset + pagination.limit;
  const paginationBasePath = currentCategorySlug
    ? `/categories/${currentCategorySlug}`
    : "/browse";

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

          <CategoryNavigation
            categories={categoryTree}
            dictionary={dictionary}
            filters={filters}
            selectedCategoryId={filters.categoryId}
          />

          <form action={paginationBasePath} method="get" className="form-stack">
            <label>
              <span>Search</span>
              <input
                defaultValue={filters.q}
                maxLength={120}
                name="q"
                placeholder="Search listings"
                type="search"
              />
            </label>

            {!currentCategorySlug ? (
              <label>
                <span>{dictionary.listings.categoriesTitle}</span>
                <select defaultValue={filters.categoryId} name="categoryId">
                  <option value="">All categories</option>
                  {orderedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {buildCategoryOptionLabel(formatCategoryName(category, dictionary), category.depth)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span>{dictionary.listings.typeLabel}</span>
              <select defaultValue={filters.listingType} name="listingType">
                <option value="">All types</option>
                {LISTING_TYPE_OPTIONS.map((listingType) => (
                  <option key={listingType} value={listingType}>
                    {formatListingType(listingType, dictionary)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{dictionary.listings.conditionLabel}</span>
              <select defaultValue={filters.condition} name="condition">
                <option value="">All conditions</option>
                {CONDITION_OPTIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {formatListingCondition(condition, dictionary)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Sort</span>
              <select defaultValue={filters.sort} name="sort">
                {SORT_OPTIONS.map((sortOption) => (
                  <option key={sortOption.value} value={sortOption.value}>
                    {sortOption.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">Apply filters</button>
            <Link href={currentCategorySlug ? `/categories/${currentCategorySlug}` : "/browse"}>
              Clear filters
            </Link>
          </form>
        </Card>

        <div className="listing-column">
          {error ? (
            <Alert
              title={dictionary.listings.listingsUnavailable}
              message={getApiErrorMessage(error, dictionary)}
            />
          ) : null}

          {!error ? (
            <p className="listing-meta">
              Showing {listings.length} of {pagination.total} listings
              {selectedCategory ? ` in ${formatCategoryName(selectedCategory, dictionary)}` : ""}
            </p>
          ) : null}

          {!error && listings.length === 0 ? (
            <EmptyState
              title={dictionary.listings.noActiveListingsTitle}
              message={dictionary.listings.noActiveListingsBody}
            />
          ) : null}

          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard apiBaseUrl={apiBaseUrl} key={listing.id} listing={listing} />
            ))}
          </div>

          {!error && pagination.total > 0 ? (
            <nav className="pagination-controls" aria-label="Listing pagination">
              {hasPreviousPage ? (
                <Link href={buildBrowseHref(filters, previousOffset, {
                  basePath: paginationBasePath,
                  includeCategoryId: !currentCategorySlug
                })}>
                  Previous
                </Link>
              ) : (
                <span className="muted">Previous</span>
              )}
              <span className="muted">
                Offset {pagination.offset}
              </span>
              {pagination.hasNextPage ? (
                <Link href={buildBrowseHref(filters, nextOffset, {
                  basePath: paginationBasePath,
                  includeCategoryId: !currentCategorySlug
                })}>
                  Next
                </Link>
              ) : (
                <span className="muted">Next</span>
              )}
            </nav>
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}

function CategoryNavigation({
  categories,
  dictionary,
  filters,
  selectedCategoryId
}: {
  categories: CategoryTreeNode[];
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  filters: BrowseListingsFilters;
  selectedCategoryId: string;
}) {
  if (categories.length === 0) {
    return <p className="muted">{dictionary.listings.categoriesUnavailable}</p>;
  }

  return (
    <nav aria-label={dictionary.listings.categoriesAriaLabel}>
      <ul className="category-list">
        <li>
          {selectedCategoryId ? (
            <Link href={buildBrowseHref(filters, 0, {
              basePath: "/browse",
              includeCategoryId: false
            })}>
              All categories
            </Link>
          ) : (
            <strong>All categories</strong>
          )}
        </li>
        {categories.map((category) => (
          <CategoryNavigationItem
            category={category}
            dictionary={dictionary}
            filters={filters}
            key={category.id}
            selectedCategoryId={selectedCategoryId}
          />
        ))}
      </ul>
    </nav>
  );
}

function CategoryNavigationItem({
  category,
  dictionary,
  filters,
  selectedCategoryId
}: {
  category: CategoryTreeNode;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  filters: BrowseListingsFilters;
  selectedCategoryId: string;
}) {
  const isSelected = category.id === selectedCategoryId;

  return (
    <li>
      {isSelected ? (
        <strong>{formatCategoryName(category, dictionary)}</strong>
      ) : (
        <Link href={buildCategoryLandingHref(filters, category.slug)}>
          {formatCategoryName(category, dictionary)}
        </Link>
      )}
      <small>{category.slug}</small>

      {category.children.length > 0 ? (
        <ul>
          {category.children.map((child) => (
            <CategoryNavigationItem
              category={child}
              dictionary={dictionary}
              filters={filters}
              key={child.id}
              selectedCategoryId={selectedCategoryId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ListingCard({ apiBaseUrl, listing }: { apiBaseUrl: string; listing: ListingSummary }) {
  const { dictionary } = useI18n();

  return (
    <article className="listing-card">
      <ListingImageFrame
        alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
        apiBaseUrl={apiBaseUrl}
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
            {listing.status === "reserved" ? (
              <Badge tone="warning">{formatListingStatus(listing.status, dictionary)}</Badge>
            ) : null}
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

function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const category of categories) {
    nodes.set(category.id, {
      ...category,
      children: [],
      depth: 0
    });
  }

  for (const node of nodes.values()) {
    if (!node.parentId) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(node.parentId);

    if (!parent) {
      roots.push(node);
      continue;
    }

    node.depth = parent.depth + 1;
    parent.children.push(node);
  }

  return sortCategoryTree(roots);
}

function sortCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((node) => ({
      ...node,
      children: sortCategoryTree(node.children)
    }));
}

function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

function buildCategoryOptionLabel(label: string, depth: number): string {
  return `${"— ".repeat(depth)}${label}`;
}

function buildCategoryLandingHref(filters: BrowseListingsFilters, slug: string): string {
  return buildBrowseHref(filters, 0, {
    basePath: `/categories/${slug}`,
    includeCategoryId: false
  });
}

function buildBrowseHref(
  filters: BrowseListingsFilters,
  offset: number,
  options: {
    basePath: string;
    includeCategoryId: boolean;
  } = {
    basePath: "/browse",
    includeCategoryId: true
  }
): string {
  const params = new URLSearchParams();

  appendIfPresent(params, "q", filters.q);

  if (options.includeCategoryId) {
    appendIfPresent(params, "categoryId", filters.categoryId);
  }

  appendIfPresent(params, "condition", filters.condition);
  appendIfPresent(params, "listingType", filters.listingType);
  appendIfPresent(params, "sort", filters.sort);
  params.set("limit", String(filters.limit));

  if (offset > 0) {
    params.set("offset", String(offset));
  }

  const query = params.toString();

  return query ? `${options.basePath}?${query}` : options.basePath;
}
