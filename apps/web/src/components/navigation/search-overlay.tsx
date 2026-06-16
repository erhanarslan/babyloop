"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import {
  getLocationLabel,
  popularSearches
} from "./public-navigation-model";

const RECENT_SEARCHES_STORAGE_KEY = "babyloop_recent_searches";
const MAX_RECENT_SEARCHES = 7;
const MAX_SEARCH_LENGTH = 80;

type SearchOverlayProps = {
  className?: string;
  dictionary: Dictionary;
  isAuthenticated: boolean;
  onNavigate?: () => void;
  selectedCity: string;
};

export function SearchOverlay({
  className = "",
  dictionary,
  isAuthenticated,
  onNavigate,
  selectedCity
}: SearchOverlayProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const sanitizedQuery = sanitizeSearchQuery(query);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.setTimeout(() => {
      panelInputRef.current?.focus();
    }, 0);
  }, [isOpen]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function submitSearch(nextQuery = sanitizedQuery) {
    const safeQuery = sanitizeSearchQuery(nextQuery);

    if (safeQuery) {
      setRecentSearches(saveRecentSearch(safeQuery));
    }

    setIsOpen(false);
    onNavigate?.();
    router.push(buildBrowseHref(safeQuery, selectedCity));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch();
  }

  function clearRecentSearches() {
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {
      // Local storage is optional for recent searches.
    }

    setRecentSearches([]);
  }

  return (
    <div className={`market-search ${className}`.trim()} ref={rootRef} role="search">
      <form className="market-search-form" onSubmit={handleSubmit}>
        <span aria-hidden="true">⌕</span>
        <label className="sr-only" htmlFor={className ? "desktop-market-search" : "mobile-market-search"}>
          {dictionary.publicShell.header.searchTitle}
        </label>
        <input
          id={className ? "desktop-market-search" : "mobile-market-search"}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={dictionary.publicShell.header.searchPlaceholder}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <button type="submit">{dictionary.nav.searchLabel}</button>
      </form>

      {isOpen ? (
        <>
          <button
            aria-label={dictionary.publicShell.header.close}
            className="market-search-backdrop"
            type="button"
            onClick={() => setIsOpen(false)}
          />
          <div className="market-search-panel" role="dialog" aria-label={dictionary.publicShell.header.searchTitle}>
            <div className="market-search-panel-heading">
              <div>
                <strong>{dictionary.publicShell.header.searchTitle}</strong>
                <span>{getLocationLabel(selectedCity)}</span>
              </div>
              <button type="button" onClick={() => setIsOpen(false)}>
                {dictionary.publicShell.header.close}
              </button>
            </div>

            <form className="market-search-panel-form" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor={className ? "desktop-market-search-panel" : "mobile-market-search-panel"}>
                {dictionary.publicShell.header.searchTitle}
              </label>
              <input
                id={className ? "desktop-market-search-panel" : "mobile-market-search-panel"}
                maxLength={MAX_SEARCH_LENGTH}
                placeholder={dictionary.publicShell.header.searchPlaceholder}
                ref={panelInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit">{dictionary.nav.searchLabel}</button>
            </form>

            <button className="market-search-submit" type="button" onClick={() => submitSearch()}>
              {sanitizedQuery
                ? `${dictionary.publicShell.header.viewResults}: ${sanitizedQuery}`
                : dictionary.publicShell.header.viewResults}
            </button>

            {recentSearches.length > 0 ? (
              <section className="market-search-section">
                <div className="market-search-section-heading">
                  <h3>{dictionary.publicShell.header.recentSearches}</h3>
                  <button type="button" onClick={clearRecentSearches}>
                    {dictionary.publicShell.header.clearRecent}
                  </button>
                </div>
                <div className="market-search-chips">
                  {recentSearches.map((item) => (
                    <button key={item} type="button" onClick={() => submitSearch(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="market-search-section">
              <h3>{dictionary.publicShell.header.popularSearches}</h3>
              <div className="market-search-chips">
                {popularSearches.map((item) => (
                  <button key={item} type="button" onClick={() => submitSearch(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="market-search-section secondary">
              <h3>{dictionary.publicShell.header.filterTitle}</h3>
              <div className="market-search-filter-grid">
                {buildSearchFilters(dictionary).map((filter) => (
                  <Link
                    href={buildBrowseHref(sanitizedQuery, selectedCity, filter.params)}
                    key={filter.label}
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate?.();
                    }}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
            </section>

            {isAuthenticated ? (
              <Link
                className="market-search-muted-action"
                href={buildBrowseHref(sanitizedQuery, selectedCity)}
                onClick={() => setIsOpen(false)}
              >
                {dictionary.publicPages.browse.saveSearch}
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function buildBrowseHref(
  query: string,
  city: string,
  filters: Record<string, string> = {}
): string {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  if (city && city !== "turkiye") {
    params.set("city", city);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  });

  const searchParams = params.toString();
  return searchParams ? `/browse?${searchParams}` : "/browse";
}

function buildSearchFilters(dictionary: Dictionary) {
  return [
    {
      label: dictionary.publicShell.header.filterSale,
      params: { listingType: "sale" }
    },
    {
      label: dictionary.publicShell.header.filterDonation,
      params: { listingType: "donation" }
    },
    {
      label: dictionary.publicShell.header.filterSwap,
      params: { listingType: "swap" }
    },
    {
      label: dictionary.publicShell.header.filterImages,
      params: { hasImages: "true" }
    },
    {
      label: dictionary.publicShell.header.filterNew,
      params: { condition: "new" }
    },
    {
      label: dictionary.publicShell.header.filterLikeNew,
      params: { condition: "like_new" }
    },
    {
      label: dictionary.publicPages.browse.sortPriceAsc,
      params: { sort: "price_asc" }
    }
  ];
}

function readRecentSearches(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY) ?? "[]");

    return Array.isArray(parsed)
      ? parsed
          .map((item) => sanitizeSearchQuery(String(item)))
          .filter(Boolean)
          .slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): string[] {
  const safeQuery = sanitizeSearchQuery(query);
  const nextSearches = [
    safeQuery,
    ...readRecentSearches().filter((item) => item.toLocaleLowerCase("tr") !== safeQuery.toLocaleLowerCase("tr"))
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(nextSearches));
  } catch {
    return nextSearches;
  }

  return nextSearches;
}

function sanitizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
}
