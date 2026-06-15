"use client";

import Link from "next/link";
import {
  Alert,
  Badge,
  Card,
  PageContainer,
  PageHeading
} from "../../components/ui";
import type {
  BrowseListingsFilters,
  Category,
  ListingSummary,
  ListingsPagination,
  SearchSuggestion
} from "../../lib/api";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ListingImageFrame } from "./listing-image-frame";
import { DiscoveryAnalyticsTracker } from "../../features/product-events/discovery-analytics-tracker";
import { recordProductEvent } from "../../features/product-events/api";
import { RecentlyViewedListings } from "./recently-viewed-listings";
import { SaveSearchButton } from "../saved-searches/save-search-button";
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
  searchSuggestions: SearchSuggestion[];
};

type CategoryTreeNode = Category & {
  children: CategoryTreeNode[];
  depth: number;
};

const CONDITION_OPTIONS = ["new", "like_new", "good", "fair", "needs_repair"] as const;
const LISTING_TYPE_OPTIONS = ["sale", "swap", "donation"] as const;
const SORT_OPTIONS = [
  { labelKey: "newest", value: "newest" },
  { labelKey: "oldest", value: "oldest" },
  { labelKey: "priceAsc", value: "price_asc" },
  { labelKey: "priceDesc", value: "price_desc" }
] as const;

type FilterChip = {
  href: string;
  label: string;
};

export function BrowsePageContent({
  apiBaseUrl,
  categories,
  currentCategorySlug,
  error,
  filters,
  listings,
  pagination,
  searchQuery,
  searchSuggestions
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
      : dictionary.publicPages.browse.title;
  const hasPreviousPage = pagination.offset > 0;
  const previousOffset = Math.max(0, pagination.offset - pagination.limit);
  const nextOffset = pagination.offset + pagination.limit;
  const paginationBasePath = currentCategorySlug
    ? `/categories/${currentCategorySlug}`
    : "/browse";
  const activeFilterChips = buildActiveFilterChips({
    currentCategorySlug,
    dictionary,
    filters,
    paginationBasePath,
    selectedCategory
  });
  const clearFiltersHref = currentCategorySlug ? `/categories/${currentCategorySlug}` : "/browse";
  const browseAssistantHref = buildAssistantHref(
    "find_products",
    buildBrowseAssistantPrompt(filters, selectedCategory, dictionary)
  );

  return (
    <>
      <DiscoveryAnalyticsTracker
        apiBaseUrl={apiBaseUrl}
        categoryId={filters.categoryId}
        resultCount={pagination.total}
        searchQuery={searchQuery}
        source={currentCategorySlug ? "category_landing" : "browse"}
      />

      {currentCategorySlug && selectedCategory ? (
        <CategoryLandingHero
          clearFiltersHref={clearFiltersHref}
          filters={filters}
          pagination={pagination}
          selectedCategory={selectedCategory}
        />
      ) : null}

      <PageHeading
        eyebrow={dictionary.listings.browseEyebrow}
        title={title}
        description={dictionary.publicPages.browse.subtitle}
      />

      <PageContainer className="browse-layout" ariaLabel={dictionary.listings.browseAriaLabel}>
        <Card as="aside" className="filter-panel" aria-label={dictionary.listings.categoriesAriaLabel}>
          <h2>{dictionary.publicPages.browse.filters}</h2>
          <p className="filter-note">{dictionary.publicPages.browse.subtitle}</p>

          <CategoryNavigation
            categories={categoryTree}
            dictionary={dictionary}
            filters={filters}
            selectedCategoryId={filters.categoryId}
          />

          <form action={paginationBasePath} method="get" className="form-stack">
            <label>
              <span>{dictionary.publicPages.browse.search}</span>
              <input
                defaultValue={filters.q}
                list="browse-search-suggestions"
                maxLength={120}
                name="q"
                placeholder={dictionary.publicShell.header.searchPlaceholder}
                type="search"
              />
              {searchSuggestions.length > 0 ? (
                <datalist id="browse-search-suggestions">
                  {searchSuggestions.map((suggestion) => (
                    <option
                      key={`${suggestion.kind}-${suggestion.label}`}
                      value={suggestion.label}
                    />
                  ))}
                </datalist>
              ) : null}
            </label>

            <SearchSuggestionLinks
              basePath={paginationBasePath}
              currentCategorySlug={currentCategorySlug}
              filters={filters}
              searchSuggestions={searchSuggestions}
            />

            {!currentCategorySlug ? (
              <label>
                <span>{dictionary.listings.categoriesTitle}</span>
                <select defaultValue={filters.categoryId} name="categoryId">
                  <option value="">{dictionary.publicPages.browse.allCategories}</option>
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
                <option value="">{dictionary.publicPages.browse.allTypes}</option>
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
                <option value="">{dictionary.publicPages.browse.allConditions}</option>
                {CONDITION_OPTIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {formatListingCondition(condition, dictionary)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{dictionary.publicPages.browse.minPrice}</span>
              <input
                defaultValue={filters.priceMin}
                inputMode="decimal"
                maxLength={13}
                name="priceMin"
                placeholder="0"
                type="text"
              />
            </label>

            <label>
              <span>{dictionary.publicPages.browse.maxPrice}</span>
              <input
                defaultValue={filters.priceMax}
                inputMode="decimal"
                maxLength={13}
                name="priceMax"
                placeholder="5000"
                type="text"
              />
            </label>

            <label className="checkbox-row">
              <input
                defaultChecked={filters.hasImages === "true"}
                name="hasImages"
                type="checkbox"
                value="true"
              />
              <span>{dictionary.publicPages.browse.imagesOnly}</span>
            </label>

            <label>
              <span>{dictionary.publicPages.browse.sort}</span>
              <select defaultValue={filters.sort} name="sort">
                {SORT_OPTIONS.map((sortOption) => (
                  <option key={sortOption.value} value={sortOption.value}>
                    {getSortLabel(sortOption.labelKey, dictionary)}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">{dictionary.publicPages.browse.apply}</button>
            <Link href={currentCategorySlug ? `/categories/${currentCategorySlug}` : "/browse"}>
              {dictionary.publicPages.browse.clear}
            </Link>
          </form>

          <SaveSearchButton
            apiBaseUrl={apiBaseUrl}
            categoryName={selectedCategory ? formatCategoryName(selectedCategory, dictionary) : undefined}
            filters={filters}
          />
        </Card>

        <div className="listing-column">
          {error ? (
            <Alert
              title={dictionary.listings.listingsUnavailable}
              message={getApiErrorMessage(error, dictionary)}
            />
          ) : null}

          {!error ? (
            <div className="listing-results-summary">
              <div>
                <p className="listing-meta">
                  {dictionary.publicPages.browse.resultCount
                    .replace("{shown}", String(listings.length))
                    .replace("{total}", String(pagination.total))}
                  {selectedCategory ? ` in ${formatCategoryName(selectedCategory, dictionary)}` : ""}
                </p>
                <p className="listing-results-helper">
                  {dictionary.publicPages.browse.subtitle}
                </p>
              </div>
              <div className="listing-results-actions" aria-label="Browse next steps">
                <Link href="/account/saved-searches">{dictionary.publicPages.browse.saveSearch}</Link>
                <Link href={browseAssistantHref}>{dictionary.publicShell.header.assistant}</Link>
              </div>
            </div>
          ) : null}

          {!error && activeFilterChips.length > 0 ? (
            <div className="active-filter-panel" aria-label="Active browse filters">
              <div>
                <p className="eyebrow">{dictionary.publicPages.browse.activeFilters}</p>
                <p className="form-note">{dictionary.publicPages.browse.noResultsBody}</p>
              </div>
              <div className="filter-chip-list">
                {activeFilterChips.map((chip) => (
                  <Link className="filter-chip" href={chip.href} key={chip.label}>
                    {chip.label}
                    <span aria-hidden="true">×</span>
                  </Link>
                ))}
                <Link className="filter-chip filter-chip-clear" href={clearFiltersHref}>
                  {dictionary.publicPages.browse.clear}
                </Link>
              </div>
            </div>
          ) : null}

          {!error && listings.length === 0 ? (
            <BrowseNoResultsPanel
              assistantHref={browseAssistantHref}
              clearFiltersHref={clearFiltersHref}
              hasActiveFilters={activeFilterChips.length > 0}
              selectedCategory={selectedCategory}
            />
          ) : null}

          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard
                apiBaseUrl={apiBaseUrl}
                key={listing.id}
                listing={listing}
                source={currentCategorySlug ? "category_landing" : "browse"}
              />
            ))}
          </div>

          <RecentlyViewedListings apiBaseUrl={apiBaseUrl} />

          {!error && pagination.total > 0 ? (
            <nav className="pagination-controls" aria-label="Listing pagination">
              {hasPreviousPage ? (
                <Link href={buildBrowseHref(filters, previousOffset, {
                  basePath: paginationBasePath,
                  includeCategoryId: !currentCategorySlug
                })}>
                  ‹
                </Link>
              ) : (
                <span className="muted">‹</span>
              )}
              <span className="muted">
                Offset {pagination.offset}
              </span>
              {pagination.hasNextPage ? (
                <Link href={buildBrowseHref(filters, nextOffset, {
                  basePath: paginationBasePath,
                  includeCategoryId: !currentCategorySlug
                })}>
                  ›
                </Link>
              ) : (
                <span className="muted">›</span>
              )}
            </nav>
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}

function CategoryLandingHero({
  clearFiltersHref,
  filters,
  pagination,
  selectedCategory
}: {
  clearFiltersHref: string;
  filters: BrowseListingsFilters;
  pagination: ListingsPagination;
  selectedCategory: Category;
}) {
  const { dictionary } = useI18n();
  const categoryName = formatCategoryName(selectedCategory, dictionary);
  const activeFilterCount = countActiveBrowseFilters(filters);

  return (
    <Card as="section" className="category-landing-hero" aria-label={`${categoryName} category landing`}>
      <div>
        <p className="eyebrow">{dictionary.publicPages.browse.category}</p>
        <h2>{categoryName}</h2>
        <p>{dictionary.publicPages.browse.subtitle}</p>

        <div className="category-landing-actions">
          <Link href={clearFiltersHref}>{dictionary.publicPages.browse.clear}</Link>
          <Link href="/account/saved-searches">{dictionary.publicPages.browse.saveSearch}</Link>
        </div>
      </div>

      <aside className="category-landing-metric-grid" aria-label="Category marketplace summary">
        <div className="category-landing-metric">
          <span>Matching listings</span>
          <strong>{pagination.total}</strong>
        </div>
        <div className="category-landing-metric">
          <span>{dictionary.publicPages.browse.activeFilters}</span>
          <strong>{activeFilterCount}</strong>
        </div>
      </aside>
    </Card>
  );
}

function BrowseNoResultsPanel({
  assistantHref,
  clearFiltersHref,
  hasActiveFilters,
  selectedCategory
}: {
  assistantHref: string;
  clearFiltersHref: string;
  hasActiveFilters: boolean;
  selectedCategory: Category | null;
}) {
  const { dictionary } = useI18n();
  const categoryName = selectedCategory ? formatCategoryName(selectedCategory, dictionary) : null;

  return (
    <Card as="section" className="browse-no-results-card">
      <div>
        <p className="eyebrow">Discovery reset</p>
        <h2>
          {hasActiveFilters
            ? "No listings match this exact search yet"
            : "No active listings are available yet"}
        </h2>
        <p>
          {hasActiveFilters
            ? `Loosen one filter${categoryName ? ` in ${categoryName}` : ""}, save the intent for later, or ask BabyLoop Assistant to turn this search into a broader plan.`
            : "Start from broader categories, create a saved search, or ask BabyLoop Assistant what to look for while the marketplace grows."}
        </p>
      </div>

      <div className="browse-no-results-actions">
        <Link href={clearFiltersHref}>{hasActiveFilters ? "Clear filters" : "Browse all"}</Link>
        <Link href={assistantHref}>Ask Assistant</Link>
        <Link href="/guides">Read buying guides</Link>
        <Link href="/sell">Create listing</Link>
      </div>

      <ul className="browse-no-results-tips" aria-label="Ways to continue browsing">
        <li>Try a wider price range or remove the image-only filter.</li>
        <li>Use age-band guides to discover adjacent categories.</li>
        <li>Save recurring searches for future marketplace matches.</li>
      </ul>
    </Card>
  );
}

function SearchSuggestionLinks({
  basePath,
  currentCategorySlug,
  filters,
  searchSuggestions
}: {
  basePath: string;
  currentCategorySlug: string | null;
  filters: BrowseListingsFilters;
  searchSuggestions: SearchSuggestion[];
}) {
  if (searchSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="search-suggestion-links" aria-label="Search suggestions">
      <span>Try</span>
      {searchSuggestions.slice(0, 5).map((suggestion) => (
        <Link
          href={buildBrowseHref(
            { ...filters, q: suggestion.label },
            0,
            {
              basePath,
              includeCategoryId: !currentCategorySlug
            }
          )}
          key={`${suggestion.kind}-${suggestion.label}`}
        >
          {suggestion.label}
        </Link>
      ))}
    </div>
  );
}

function buildBrowseAssistantPrompt(
  filters: BrowseListingsFilters,
  selectedCategory: Category | null,
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  const categoryName = selectedCategory ? formatCategoryName(selectedCategory, dictionary) : "all baby categories";
  const parts = [
    filters.q ? `search phrase: ${filters.q}` : "",
    categoryName ? `category: ${categoryName}` : "",
    filters.listingType ? `listing type: ${formatListingType(filters.listingType, dictionary)}` : "",
    filters.condition ? `condition: ${formatListingCondition(filters.condition, dictionary)}` : "",
    filters.priceMin ? `minimum price: ${filters.priceMin}` : "",
    filters.priceMax ? `maximum price: ${filters.priceMax}` : "",
    filters.hasImages === "true" ? "only listings with images" : ""
  ].filter(Boolean);

  return parts.length > 0
    ? `Help me turn this BabyLoop browse intent into a short product discovery plan: ${parts.join("; ")}.`
    : "Help me build a BabyLoop browsing plan for second-hand baby essentials.";
}

function getSortLabel(
  labelKey: (typeof SORT_OPTIONS)[number]["labelKey"],
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  const labels = {
    newest: dictionary.publicPages.browse.sortNewest,
    oldest: dictionary.publicPages.browse.sortOldest,
    priceAsc: dictionary.publicPages.browse.sortPriceAsc,
    priceDesc: dictionary.publicPages.browse.sortPriceDesc
  };

  return labels[labelKey];
}

function countActiveBrowseFilters(filters: BrowseListingsFilters): number {
  return [
    filters.q,
    filters.categoryId,
    filters.listingType,
    filters.condition,
    filters.priceMin,
    filters.priceMax,
    filters.hasImages === "true" ? "hasImages" : ""
  ].filter((value) => String(value).trim().length > 0).length;
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

function ListingCard({
  apiBaseUrl,
  listing,
  source
}: {
  apiBaseUrl: string;
  listing: ListingSummary;
  source: "browse" | "category_landing";
}) {
  const { dictionary } = useI18n();

  return (
    <article className="listing-card listing-card-discovery">
      <ListingImageFrame
        alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
        apiBaseUrl={apiBaseUrl}
        className="listing-card-image"
        fallbackLabel={dictionary.listings.noProductImage}
        url={listing.firstImage?.url ?? null}
      />
      <div className="listing-card-body">
        <div>
          <div className="listing-card-topline">
            <div className="listing-card-badges">
              <Badge>{formatCategoryName(listing.category, dictionary)}</Badge>
              <Badge tone="success">
                {dictionary.listings.typeLabel}: {formatListingType(listing.listingType, dictionary)}
              </Badge>
              {listing.status === "reserved" ? (
                <Badge tone="warning">{formatListingStatus(listing.status, dictionary)}</Badge>
              ) : (
                <Badge>{formatListingStatus(listing.status, dictionary)}</Badge>
              )}
            </div>
            <time dateTime={listing.createdAt}>{formatBrowseListingDate(listing.createdAt)}</time>
          </div>
          <h2>{listing.title}</h2>
          <p className="muted">
            {dictionary.listings.conditionLabel}: {formatListingCondition(listing.condition, dictionary)}
          </p>
        </div>

        <div className="browse-card-context">
          <p>
            Ask about condition, missing parts, pickup expectations, and whether this item fits your current age-band needs.
          </p>
          <Link
            href={buildAssistantHref(
              "safe_buying",
              `What should I check before buying a second-hand ${formatCategoryName(
                listing.category,
                dictionary
              )} item like ${listing.title}?`
            )}
          >
            Ask checks
          </Link>
        </div>

        <div className="listing-card-footer">
          <div className="listing-card-price-stack">
            <strong>{formatListingPrice(listing.price, dictionary)}</strong>
            <span>{listing.favoriteCount} saved · {formatListingCondition(listing.condition, dictionary)}</span>
          </div>
          <Link
            href={`/listings/${listing.id}`}
            onClick={() => {
              void recordProductEvent(apiBaseUrl, {
                categoryId: listing.category.id,
                eventType: "listing_card_clicked",
                listingId: listing.id,
                source
              });
            }}
          >
            {dictionary.common.viewDetails}
          </Link>
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

function buildActiveFilterChips({
  currentCategorySlug,
  dictionary,
  filters,
  paginationBasePath,
  selectedCategory
}: {
  currentCategorySlug: string | null;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  filters: BrowseListingsFilters;
  paginationBasePath: string;
  selectedCategory: Category | null;
}): FilterChip[] {
  const chips: FilterChip[] = [];

  if (!currentCategorySlug && selectedCategory) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        categoryId: ""
      }),
      label: `Category: ${formatCategoryName(selectedCategory, dictionary)}`
    });
  }

  if (filters.q.trim()) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        q: ""
      }),
      label: `Search: ${filters.q.trim()}`
    });
  }

  if (filters.listingType) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        listingType: ""
      }),
      label: `Type: ${formatListingType(filters.listingType, dictionary)}`
    });
  }

  if (filters.condition) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        condition: ""
      }),
      label: `Condition: ${formatListingCondition(filters.condition, dictionary)}`
    });
  }

  if (filters.priceMin) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        priceMin: ""
      }),
      label: `Min: ${filters.priceMin}`
    });
  }

  if (filters.priceMax) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        priceMax: ""
      }),
      label: `Max: ${filters.priceMax}`
    });
  }

  if (filters.hasImages === "true") {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        hasImages: ""
      }),
      label: "Images only"
    });
  }

  if (filters.sort && filters.sort !== "newest") {
    const sortOption = SORT_OPTIONS.find((option) => option.value === filters.sort);
    const sortLabel = sortOption ? getSortLabel(sortOption.labelKey, dictionary) : filters.sort;

    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        sort: "newest"
      }),
      label: `Sort: ${sortLabel}`
    });
  }

  return chips;
}

function buildBrowseHrefWithOverrides(
  filters: BrowseListingsFilters,
  paginationBasePath: string,
  currentCategorySlug: string | null,
  overrides: Partial<BrowseListingsFilters>
): string {
  return buildBrowseHref(
    {
      ...filters,
      ...overrides
    },
    0,
    {
      basePath: paginationBasePath,
      includeCategoryId: !currentCategorySlug
    }
  );
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
  appendIfPresent(params, "priceMin", filters.priceMin);
  appendIfPresent(params, "priceMax", filters.priceMax);
  appendIfPresent(params, "hasImages", filters.hasImages);
  appendIfPresent(params, "sort", filters.sort);
  params.set("limit", String(filters.limit));

  if (offset > 0) {
    params.set("offset", String(offset));
  }

  const query = params.toString();

  return query ? `${options.basePath}?${query}` : options.basePath;
}

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}

function formatBrowseListingDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently listed";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short"
  }).format(date);
}
