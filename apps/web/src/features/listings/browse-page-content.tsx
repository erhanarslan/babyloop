"use client";

import Link from "next/link";
import {
  DEFAULT_LOCATION,
  LOCATION_CHANGED_EVENT,
  storeLocation
} from "../../components/navigation/location-selector";
import {
  getLocationLabel,
  locationOptions
} from "../../components/navigation/public-navigation-model";
import {
  Alert,
  Badge,
  Card,
  PageContainer
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
import { ListingHoverImageFrame } from "./listing-hover-image-frame";
import { DiscoveryAnalyticsTracker } from "../../features/product-events/discovery-analytics-tracker";
import { recordProductEvent } from "../../features/product-events/api";
import { RecentlyViewedListings } from "./recently-viewed-listings";
import { SaveSearchButton } from "../saved-searches/save-search-button";
import { appendIfPresent } from "./browse-routing";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice,
  formatListingType
} from "./listing-display";
import styles from "./browse-page-content.module.css";

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
  clearsLocation?: boolean;
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

      <PageContainer className="grid gap-5 pb-12 pt-5 lg:grid-cols-[320px_minmax(0,1fr)]" ariaLabel={dictionary.listings.browseAriaLabel}>
        <BrowseFilterSidebar
          apiBaseUrl={apiBaseUrl}
          clearFiltersHref={clearFiltersHref}
          currentCategorySlug={currentCategorySlug}
          dictionary={dictionary}
          filters={filters}
          orderedCategories={orderedCategories}
          paginationBasePath={paginationBasePath}
          searchSuggestions={searchSuggestions}
          selectedCategory={selectedCategory}
        />

        <div className="listing-column">
          {error ? (
            <Alert
              title={dictionary.listings.listingsUnavailable}
              message={getApiErrorMessage(error, dictionary)}
            />
          ) : null}

          {!error ? (
            <div className={`${styles.resultsSummary} browse-results-summary`}>
              <div>
                <p className="eyebrow">İlanları keşfet</p>
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  {title}
                </h1>
                <p className={styles.resultsHelper}>
                  {pagination.total} ilan · {filters.sort === "newest" ? "En yeni ilanlar önce" : "Seçili sıralama uygulanıyor"}
                </p>
              </div>
            </div>
          ) : null}

          {!error && activeFilterChips.length > 0 ? (
            <div className="active-filter-panel" aria-label="Active browse filters">
              <p className="eyebrow">Aktif filtreler</p>
              <div className="filter-chip-list">
                {activeFilterChips.map((chip) => (
                  <Link
                    className="filter-chip"
                    href={chip.href}
                    key={chip.label}
                    {...(chip.clearsLocation ? { onClick: clearMarketplaceLocation } : {})}
                  >
                    {chip.label}
                    <span aria-hidden="true">×</span>
                  </Link>
                ))}
                <Link className="filter-chip filter-chip-clear" href={clearFiltersHref}>
                  Temizle
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
                {Math.floor(pagination.offset / pagination.limit) + 1}. sayfa
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

function BrowseFilterSidebar({
  apiBaseUrl,
  clearFiltersHref,
  currentCategorySlug,
  dictionary,
  filters,
  orderedCategories,
  paginationBasePath,
  searchSuggestions,
  selectedCategory
}: {
  apiBaseUrl: string;
  clearFiltersHref: string;
  currentCategorySlug: string | null;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  filters: BrowseListingsFilters;
  orderedCategories: CategoryTreeNode[];
  paginationBasePath: string;
  searchSuggestions: SearchSuggestion[];
  selectedCategory: Category | null;
}) {
  const selectedCategoryName = selectedCategory ? formatCategoryName(selectedCategory, dictionary) : null;

  return (
    <Card as="aside" className="filter-panel babyloop-filter-panel self-start" aria-label="Filtreler">
      <div className="babyloop-filter-heading">
        <h2>Filtreler</h2>
        <Link className="babyloop-filter-reset" href={clearFiltersHref}>
          Temizle
        </Link>
      </div>

      <form action={paginationBasePath} method="get" className="babyloop-filter-form">
        {filters.city ? <input name="city" type="hidden" value={filters.city} /> : null}
        <section className="babyloop-filter-section">
          <label className="babyloop-filter-field">
            <span>Arama</span>
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
        </section>

        <section className="babyloop-filter-section">
          {!currentCategorySlug ? (
            <label className="babyloop-filter-field">
              <span>Kategori</span>
              <select defaultValue={filters.categoryId} name="categoryId">
                <option value="">{dictionary.publicPages.browse.allCategories}</option>
                {orderedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {buildCategoryOptionLabel(formatCategoryName(category, dictionary), category.depth)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="babyloop-selected-category">
              <span>Kategori</span>
              <strong>{selectedCategoryName ?? dictionary.publicPages.browse.category}</strong>
              <Link href="/browse">Tüm kategoriler</Link>
            </div>
          )}
        </section>

        <section className="babyloop-filter-section">
          <label className="babyloop-filter-field">
            <span>İlan tipi</span>
            <select defaultValue={filters.listingType} name="listingType">
              <option value="">{dictionary.publicPages.browse.allTypes}</option>
              {LISTING_TYPE_OPTIONS.map((listingType) => (
                <option key={listingType} value={listingType}>
                  {formatListingType(listingType, dictionary)}
                </option>
              ))}
            </select>
          </label>

          <label className="babyloop-filter-field">
            <span>Durum</span>
            <select defaultValue={filters.condition} name="condition">
              <option value="">{dictionary.publicPages.browse.allConditions}</option>
              {CONDITION_OPTIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {formatListingCondition(condition, dictionary)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="babyloop-filter-section">
          <div className="babyloop-filter-row">
            <label className="babyloop-filter-field">
              <span>En az</span>
              <input
                defaultValue={filters.priceMin}
                inputMode="decimal"
                maxLength={13}
                name="priceMin"
                placeholder="0"
                type="text"
              />
            </label>

            <label className="babyloop-filter-field">
              <span>En çok</span>
              <input
                defaultValue={filters.priceMax}
                inputMode="decimal"
                maxLength={13}
                name="priceMax"
                placeholder="5000"
                type="text"
              />
            </label>
          </div>

        </section>

        <section className="babyloop-filter-section">
          <label className="babyloop-filter-field">
            <span>Sıralama</span>
            <select defaultValue={filters.sort} name="sort">
              {SORT_OPTIONS.map((sortOption) => (
                <option key={sortOption.value} value={sortOption.value}>
                  {getSortLabel(sortOption.labelKey, dictionary)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <div className="babyloop-filter-actions">
          <button type="submit">Uygula</button>
        </div>
      </form>

      <details className="babyloop-save-search-details">
        <summary>Aramayı kaydet</summary>
        <SaveSearchButton
          apiBaseUrl={apiBaseUrl}
          categoryName={selectedCategoryName ?? undefined}
          filters={filters}
        />
      </details>
    </Card>
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
    <Card as="section" className="category-landing-hero" aria-label={`${categoryName} kategori özeti`}>
      <div>
        <p className="eyebrow">{dictionary.publicPages.browse.category}</p>
        <h2>{categoryName}</h2>
        <p>{dictionary.publicPages.browse.subtitle}</p>

        <div className="category-landing-actions">
          <Link href={clearFiltersHref}>{dictionary.publicPages.browse.clear}</Link>
          <Link href="/account/saved-searches">{dictionary.publicPages.browse.saveSearch}</Link>
        </div>
      </div>

      <aside className="category-landing-metric-grid" aria-label="Kategori pazar özeti">
        <div className="category-landing-metric">
          <span>Eşleşen ilan</span>
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
    <Card as="section" className={styles.noResultsCard ?? ""}>
      <div>
        <p className="eyebrow">Sonuç yok</p>
        <h2>
          {hasActiveFilters
            ? "Bu filtrelerle ilan bulunamadı"
            : "Henüz uygun ilan yok"}
        </h2>
        <p>
          {hasActiveFilters
            ? `${categoryName ? `${categoryName} içinde ` : ""}Bir filtreyi gevşet veya aramayı daha sonra kullanmak için kaydet.`
            : "Daha geniş kategorilerden başlayabilir veya yeni ilanları takip etmek için arama kaydedebilirsin."}
        </p>
      </div>

      <div className={styles.noResultsActions}>
        <Link href={clearFiltersHref}>{hasActiveFilters ? "Filtreleri temizle" : "Tüm ilanlar"}</Link>
        <Link href={assistantHref}>Asistana sor</Link>
        <Link href="/sell">İlan ver</Link>
      </div>

      <ul className={styles.noResultsTips} aria-label="Aramaya devam etme önerileri">
        <li>Fiyat aralığını genişletmeyi dene.</li>
        <li>Benzer ihtiyaçlar için aramayı kaydet.</li>
      </ul>
    </Card>
  );
}

function buildBrowseAssistantPrompt(
  filters: BrowseListingsFilters,
  selectedCategory: Category | null,
  dictionary: ReturnType<typeof useI18n>["dictionary"]
): string {
  const categoryName = selectedCategory
    ? formatCategoryName(selectedCategory, dictionary)
    : "tüm bebek kategorileri";
  const parts = [
    filters.q ? `arama: ${filters.q}` : "",
    filters.city ? `konum: ${formatBrowseCity(filters.city)}` : "",
    categoryName ? `kategori: ${categoryName}` : "",
    filters.listingType ? `ilan tipi: ${formatListingType(filters.listingType, dictionary)}` : "",
    filters.condition ? `durum: ${formatListingCondition(filters.condition, dictionary)}` : "",
    filters.priceMin ? `en az fiyat: ${filters.priceMin}` : "",
    filters.priceMax ? `en çok fiyat: ${filters.priceMax}` : "",
  ].filter(Boolean);

  return parts.length > 0
    ? `Bu BabyLoop araması için kısa bir ürün keşif planı hazırla: ${parts.join("; ")}.`
    : "İkinci el bebek ürünleri için kısa bir BabyLoop keşif planı hazırla.";
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
    filters.city,
    filters.categoryId,
    filters.listingType,
    filters.condition,
    filters.priceMin,
    filters.priceMax,
  ].filter((value) => String(value).trim().length > 0).length;
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
    <article className={`browse-listing-card listing-card ${styles.listingCard}`}>
      <Link
        aria-label={`${listing.title} ilanını aç`}
        className="browse-listing-card-hit-area"
        href={`/listings/${listing.id}`}
        onClick={() => {
          void recordProductEvent(apiBaseUrl, {
            categoryId: listing.category.id,
            eventType: "listing_card_clicked",
            listingId: listing.id,
            source
          });
        }}
      />

      <ListingHoverImageFrame
        alt={dictionary.listings.productImageAlt.replace("{title}", listing.title)}
        apiBaseUrl={apiBaseUrl}
        className="listing-card-image"
        fallbackLabel={dictionary.listings.noProductImage}
        images={listing.images?.length ? listing.images : listing.firstImage ? [listing.firstImage] : []}
      />
      <div className="listing-card-body babyloop-listing-card-body">
        <div className="listing-card-badges babyloop-listing-card-badges">
          <Badge>{formatCategoryName(listing.category, dictionary)}</Badge>
          <Badge tone={listing.listingType === "donation" ? "warning" : "success"}>
            {formatListingType(listing.price ? listing.listingType : "donation", dictionary)}
          </Badge>
        </div>

        <h2>{listing.title}</h2>

        <div className="listing-card-footer babyloop-listing-card-footer">
          <strong>{formatListingPrice(listing.price, dictionary)}</strong>
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
      label: `Kategori: ${formatCategoryName(selectedCategory, dictionary)}`
    });
  }

  if (filters.q.trim()) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        q: ""
      }),
      label: `Arama: ${filters.q.trim()}`
    });
  }

  if (filters.city.trim()) {
    chips.push({
      clearsLocation: true,
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        city: ""
      }),
      label: `Konum: ${formatBrowseCity(filters.city)}`
    });
  }

  if (filters.listingType) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        listingType: ""
      }),
      label: `İlan tipi: ${formatListingType(filters.listingType, dictionary)}`
    });
  }

  if (filters.condition) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        condition: ""
      }),
      label: `Durum: ${formatListingCondition(filters.condition, dictionary)}`
    });
  }

  if (filters.priceMin) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        priceMin: ""
      }),
      label: `En az: ${filters.priceMin}`
    });
  }

  if (filters.priceMax) {
    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        priceMax: ""
      }),
      label: `En çok: ${filters.priceMax}`
    });
  }


  if (filters.sort && filters.sort !== "newest") {
    const sortOption = SORT_OPTIONS.find((option) => option.value === filters.sort);
    const sortLabel = sortOption ? getSortLabel(sortOption.labelKey, dictionary) : filters.sort;

    chips.push({
      href: buildBrowseHrefWithOverrides(filters, paginationBasePath, currentCategorySlug, {
        sort: "newest"
      }),
      label: `Sıralama: ${sortLabel}`
    });
  }

  return chips;
}

function clearMarketplaceLocation(): void {
  storeLocation(DEFAULT_LOCATION);
  window.dispatchEvent(new CustomEvent(LOCATION_CHANGED_EVENT, {
    detail: { city: DEFAULT_LOCATION }
  }));
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
  appendIfPresent(params, "city", filters.city);

  if (options.includeCategoryId) {
    appendIfPresent(params, "categoryId", filters.categoryId);
  }

  appendIfPresent(params, "condition", filters.condition);
  appendIfPresent(params, "listingType", filters.listingType);
  appendIfPresent(params, "priceMin", filters.priceMin);
  appendIfPresent(params, "priceMax", filters.priceMax);
  appendIfPresent(params, "sort", filters.sort);
  params.set("limit", String(filters.limit));

  if (offset > 0) {
    params.set("offset", String(offset));
  }

  const query = params.toString();

  return query ? `${options.basePath}?${query}` : options.basePath;
}

function formatBrowseCity(value: string): string {
  const normalizedValue = value.trim().toLocaleLowerCase("tr-TR");
  const location = locationOptions.find((option) => (
    option.value.toLocaleLowerCase("tr-TR") === normalizedValue ||
    getLocationLabel(option.value).toLocaleLowerCase("tr-TR") === normalizedValue
  ));

  return location ? getLocationLabel(location.value) : value.trim();
}

type AssistantEntryMode = "age_needs" | "find_products" | "sell_help" | "safe_buying" | "platform_help";

function buildAssistantHref(mode: AssistantEntryMode, prompt: string): string {
  const params = new URLSearchParams({
    mode,
    prompt
  });

  return `/assistant?${params.toString()}`;
}
