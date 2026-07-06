"use client";

import { useCallback, useEffect, useState } from "react";
import { listFavoriteListings, removeFavoriteListing, type FavoriteListing } from "./favorites-api";

type LoadState = "idle" | "loading" | "ready" | "error";

export function FavoritesPageContent() {
  const [items, setItems] = useState<FavoriteListing[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setError(null);

    try {
      setItems(await listFavoriteListings());
      setLoadState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Favoriler yüklenemedi.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRemove(listingId: string) {
    setBusyListingId(listingId);
    setError(null);

    try {
      await removeFavoriteListing(listingId);
      setItems((current) => current.filter((item) => item.id !== listingId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Favori kaldırılamadı.");
    } finally {
      setBusyListingId(null);
    }
  }

  return (
    <main style={{ display: "grid", gap: 24, margin: "0 auto", maxWidth: 980, padding: 24 }}>
      <header>
        <p style={{ margin: 0, opacity: 0.72 }}>Beğendiğin ilanları daha sonra hızlıca bul.</p>
        <h1 style={{ margin: "6px 0 0" }}>Favorilerim</h1>
      </header>

      {error ? <section role="alert" style={{ border: "1px solid #f2b8b5", borderRadius: 14, padding: 14 }}>{error}</section> : null}
      {loadState === "loading" ? <p>Favoriler yükleniyor...</p> : null}

      {loadState !== "loading" && items.length === 0 ? (
        <section style={{ border: "1px dashed var(--color-border, #d7d7d7)", borderRadius: 18, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Henüz favori ilanın yok</h2>
          <p>İlan kartlarındaki favori aksiyonuyla ürünleri burada toplayabilirsin.</p>
        </section>
      ) : null}

      {items.length > 0 ? (
        <section aria-label="Favori ilanlar" style={{ display: "grid", gap: 12 }}>
          {items.map((listing) => (
            <article key={listing.id} style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: 16, display: "flex", justifyContent: "space-between", gap: 12, padding: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>{listing.title}</h2>
                <p style={{ margin: "6px 0 0", opacity: 0.72 }}>{[listing.city, listing.seller?.displayName].filter(Boolean).join(" · ") || "Güvenli satıcı özeti"}</p>
              </div>
              <button disabled={busyListingId === listing.id} type="button" onClick={() => void handleRemove(listing.id)}>Favoriden kaldır</button>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
