"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteSavedSearch,
  listSavedSearches,
  type SavedSearch
} from "./saved-searches-api";
import type { SavedSearchFilters } from "./saved-searches-model";

type LoadState = "loading" | "ready" | "error";

export function SavedSearchesPageContent(
  _props: { apiBaseUrl?: string } = {}
) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      setItems(await listSavedSearches());
      setLoadState("ready");
    } catch {
      setErrorMessage("Kayıtlı aramalar şu anda yüklenemiyor.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const notificationEnabledCount = useMemo(
    () => items.filter((item) => item.notificationEnabled).length,
    [items]
  );

  async function handleDelete(savedSearchId: string) {
    setDeletingId(savedSearchId);
    setErrorMessage(null);

    try {
      await deleteSavedSearch(savedSearchId);
      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== savedSearchId)
      );
      setDeleteCandidateId(null);
    } catch {
      setErrorMessage("Kayıtlı arama silinemedi. Tekrar deneyebilirsin.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main
      aria-label="Kayıtlı aramalarım"
      className="saved-searches-management-page"
    >
      <header className="saved-searches-management-hero">
        <div>
          <p className="eyebrow">Arama yönetimi</p>
          <h1>Kayıtlı aramalarım</h1>
          <p>
            Aramayı Browse sayfasında filtreleyip kaydet. Burada kayıtlarını
            yeniden açabilir, bildirim tercihlerine gidebilir veya silebilirsin.
          </p>
        </div>

        <Link className="saved-searches-create-link" href="/browse">
          Browse&apos;da yeni arama oluştur
        </Link>
      </header>

      <section
        aria-label="Kayıtlı arama özeti"
        className="saved-searches-summary-grid"
      >
        <article>
          <span>Toplam kayıt</span>
          <strong>{items.length}</strong>
        </article>
        <article>
          <span>Bildirimi açık</span>
          <strong>{notificationEnabledCount}</strong>
        </article>
        <article>
          <span>Varsayılan sıralama</span>
          <strong>En yeni</strong>
        </article>
      </section>

      {errorMessage ? (
        <div className="saved-searches-management-alert" role="alert">
          <span>{errorMessage}</span>
          {loadState === "error" ? (
            <button type="button" onClick={() => void loadItems()}>
              Tekrar dene
            </button>
          ) : null}
        </div>
      ) : null}

      {loadState === "loading" ? (
        <section className="saved-searches-management-state" role="status">
          <span className="saved-searches-loading-dot" aria-hidden="true" />
          <div>
            <strong>Kayıtlı aramalar yükleniyor</strong>
            <p>Filtrelerin ve bildirim tercihlerin hazırlanıyor.</p>
          </div>
        </section>
      ) : null}

      {loadState === "ready" && items.length === 0 ? (
        <section className="saved-searches-management-empty">
          <div aria-hidden="true">⌕</div>
          <h2>Henüz kayıtlı araman yok</h2>
          <p>
            Browse sayfasında filtrelerini seçip “Bu aramayı kaydet” aksiyonunu
            kullanabilirsin.
          </p>
          <Link href="/browse">İlanları keşfet</Link>
        </section>
      ) : null}

      {loadState === "ready" && items.length > 0 ? (
        <section
          aria-label="Kayıtlı aramalar"
          className="saved-searches-management-list"
        >
          {items.map((item) => {
            const chips = buildSavedSearchChips(item.filters);
            const isDeleteCandidate = deleteCandidateId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <article className="saved-search-management-card" key={item.id}>
                <div className="saved-search-management-card-heading">
                  <div>
                    <span>Kayıtlı arama</span>
                    <h2>{item.name}</h2>
                  </div>

                  <span
                    className={
                      item.notificationEnabled
                        ? "saved-search-notification-state is-enabled"
                        : "saved-search-notification-state"
                    }
                  >
                    {item.notificationEnabled
                      ? "Bildirim açık"
                      : "Bildirim kapalı"}
                  </span>
                </div>

                <div
                  aria-label={`${item.name} filtreleri`}
                  className="saved-search-filter-chips"
                >
                  {chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>

                <footer className="saved-search-management-actions">
                  <Link
                    className="saved-search-open-link"
                    href={buildSavedSearchHref(item.filters)}
                  >
                    Aramayı aç
                  </Link>

                  <Link
                    className="saved-search-notification-link"
                    href="/account/notification-preferences"
                  >
                    Bildirim ayarları
                  </Link>

                  {isDeleteCandidate ? (
                    <div className="saved-search-delete-confirmation">
                      <span>Bu kayıt silinsin mi?</span>
                      <button
                        disabled={isDeleting}
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                      >
                        {isDeleting ? "Siliniyor..." : "Silmeyi onayla"}
                      </button>
                      <button
                        disabled={isDeleting}
                        type="button"
                        onClick={() => setDeleteCandidateId(null)}
                      >
                        Vazgeç
                      </button>
                    </div>
                  ) : (
                    <button
                      className="saved-search-delete-trigger"
                      type="button"
                      onClick={() => setDeleteCandidateId(item.id)}
                    >
                      Sil
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

export function buildSavedSearchHref(filters: SavedSearchFilters): string {
  const params = new URLSearchParams();

  appendFilter(params, "q", filters.q);
  appendFilter(params, "city", filters.city);
  appendFilter(params, "categoryId", filters.categoryId);
  appendFilter(params, "condition", filters.condition);
  appendFilter(params, "listingType", filters.listingType);

  if (filters.priceMin !== undefined) {
    params.set("priceMin", String(filters.priceMin));
  }

  if (filters.priceMax !== undefined) {
    params.set("priceMax", String(filters.priceMax));
  }

  if (filters.sort && filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }

  const query = params.toString();

  return query ? `/browse?${query}` : "/browse";
}

export function buildSavedSearchChips(filters: SavedSearchFilters): string[] {
  const chips: string[] = [];

  if (filters.q) {
    chips.push(`Arama: ${filters.q}`);
  }

  if (filters.city) {
    chips.push(`Şehir: ${filters.city}`);
  }

  if (filters.listingType) {
    chips.push(`İlan tipi: ${formatListingType(filters.listingType)}`);
  }

  if (filters.condition) {
    chips.push(`Durum: ${formatCondition(filters.condition)}`);
  }

  if (filters.priceMin !== undefined) {
    chips.push(`En az: ${formatPrice(filters.priceMin)}`);
  }

  if (filters.priceMax !== undefined) {
    chips.push(`En çok: ${formatPrice(filters.priceMax)}`);
  }

  chips.push(`Sıralama: ${formatSort(filters.sort ?? "newest")}`);

  return chips;
}

function appendFilter(
  params: URLSearchParams,
  key: string,
  value: string | undefined
) {
  if (value?.trim()) {
    params.set(key, value.trim());
  }
}

function formatSort(sort: NonNullable<SavedSearchFilters["sort"]>): string {
  const labels: Record<NonNullable<SavedSearchFilters["sort"]>, string> = {
    newest: "En yeni",
    oldest: "En eski",
    price_asc: "Fiyat: düşükten yükseğe",
    price_desc: "Fiyat: yüksekten düşüğe",
    relevance: "En alakalı"
  };

  return labels[sort];
}

function formatListingType(
  listingType: NonNullable<SavedSearchFilters["listingType"]>
): string {
  const labels: Record<
    NonNullable<SavedSearchFilters["listingType"]>,
    string
  > = {
    sale: "Satılık",
    swap: "Takas",
    donation: "Bağış"
  };

  return labels[listingType];
}

function formatCondition(
  condition: NonNullable<SavedSearchFilters["condition"]>
): string {
  const labels: Record<NonNullable<SavedSearchFilters["condition"]>, string> = {
    new: "Yeni",
    like_new: "Yeni gibi",
    good: "İyi",
    fair: "Orta",
    needs_repair: "Onarım gerekli"
  };

  return labels[condition];
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2
  }).format(value);
}
