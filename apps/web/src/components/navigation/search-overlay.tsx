"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ListingsPayload } from "../../lib/api";
import type { Dictionary } from "../../lib/i18n/dictionaries";

const RECENT_SEARCHES_STORAGE_KEY = "babyloop_recent_searches";
const MAX_RECENT_SEARCHES = 7;
const MAX_SEARCH_LENGTH = 80;
const MIN_SUGGESTION_QUERY_LENGTH = 3;
const SUGGESTION_DEBOUNCE_MS = 250;

type SearchOverlayProps = {
  apiBaseUrl: string;
  className?: string;
  dictionary: Dictionary;
  isAuthenticated: boolean;
  onNavigate?: () => void;
  selectedCity: string;
};

type SearchSuggestion = {
  id: string;
  title: string;
  categoryName: string;
};

export function SearchOverlay({
  apiBaseUrl,
  className = "",
  dictionary,
  onNavigate,
  selectedCity
}: SearchOverlayProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);

  const sanitizedQuery = useMemo(() => sanitizeSearchQuery(query), [query]);
  const shouldShowSuggestions = isFocused && sanitizedQuery.length >= MIN_SUGGESTION_QUERY_LENGTH;

  useEffect(() => {
    if (!shouldShowSuggestions) {
      setSuggestions([]);
      setIsSuggestionLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSuggestionLoading(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/listings?limit=5&offset=0&sort=newest&q=${encodeURIComponent(
            sanitizedQuery
          )}&hasImages=true`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        const body = (await response.json()) as { ok: boolean; data?: ListingsPayload };

        if (!response.ok || !body.ok || !body.data) {
          setSuggestions([]);
          return;
        }

        setSuggestions(
          body.data.listings.map((listing) => ({
            id: listing.id,
            title: listing.title,
            categoryName: listing.category.name
          }))
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSuggestionLoading(false);
        }
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiBaseUrl, sanitizedQuery, shouldShowSuggestions]);

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

  function submitSearch(nextQuery = sanitizedQuery) {
    const safeQuery = sanitizeSearchQuery(nextQuery);

    if (safeQuery) {
      saveRecentSearch(safeQuery);
    }

    setIsFocused(false);
    onNavigate?.();
    router.push(buildBrowseHref(safeQuery, selectedCity));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch();
  }

  return (
    <div ref={containerRef} className={`market-search ${className}`.trim()} role="search">
      <form className="market-search-form" onSubmit={handleSubmit}>
        <span aria-hidden="true">⌕</span>

        <label
          className="sr-only"
          htmlFor={className ? "desktop-market-search" : "mobile-market-search"}
        >
          {dictionary.publicShell.header.searchTitle}
        </label>

        <input
          id={className ? "desktop-market-search" : "mobile-market-search"}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={dictionary.publicShell.header.searchPlaceholder}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
        />

        <button type="submit">{dictionary.nav.searchLabel}</button>
      </form>

      {shouldShowSuggestions ? (
        <div className="market-search-suggestions" role="listbox">
          {isSuggestionLoading ? (
            <p>Aranıyor...</p>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => submitSearch(suggestion.title)}
              >
                <strong>{suggestion.title}</strong>
                <span>{suggestion.categoryName}</span>
              </button>
            ))
          ) : (
            <p>Sonuç bulunamadı. Aramayı yine de yapabilirsin.</p>
          )}
        </div>
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

function sanitizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
}

function readRecentSearches(): string[] {
  try {
    const rawValue = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((item): item is string => typeof item === "string")
      .map(sanitizeSearchQuery)
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): string[] {
  const nextSearches = [
    query,
    ...readRecentSearches().filter(
      (item) => item.toLocaleLowerCase("tr") !== query.toLocaleLowerCase("tr")
    )
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(nextSearches));
  } catch {
    // Local storage is optional for recent searches.
  }

  return nextSearches;
}
