"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createSavedSearch, deleteSavedSearch, listSavedSearches, type SavedSearch } from "./saved-searches-api";
import { createSavedSearchDraft } from "./saved-searches-model";

type LoadState = "idle" | "loading" | "ready" | "error";

const inputStyle = {
  border: "1px solid var(--color-border, #d7d7d7)",
  borderRadius: 10,
  padding: "10px 12px",
  width: "100%"
};

export function SavedSearchesPageContent(_props: { apiBaseUrl?: string } = {}) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("newest");
  const [isSubmitting, setSubmitting] = useState(false);

  const hasItems = items.length > 0;

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setError(null);

    try {
      setItems(await listSavedSearches());
      setLoadState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kayıtlı aramalar yüklenemedi.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const title = useMemo(() => {
    if (loadState === "loading") {
      return "Kayıtlı aramalar yükleniyor";
    }

    return hasItems ? "Kayıtlı aramalarım" : "Henüz kayıtlı arama yok";
  }, [hasItems, loadState]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const draft = createSavedSearchDraft({ name, q, city, sort });
      const created = await createSavedSearch(draft);
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setName("");
      setQ("");
      setCity("");
      setSort("newest");
      setLoadState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kayıtlı arama oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(savedSearchId: string) {
    setError(null);

    try {
      await deleteSavedSearch(savedSearchId);
      setItems((current) => current.filter((item) => item.id !== savedSearchId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kayıtlı arama silinemedi.");
    }
  }

  return (
    <main style={{ display: "grid", gap: 24, margin: "0 auto", maxWidth: 960, padding: 24 }}>
      <header>
        <p style={{ margin: 0, opacity: 0.72 }}>Arama kriterlerini kaydet, sonra aynı filtreye tek tıkla dön.</p>
        <h1 style={{ margin: "6px 0 0" }}>{title}</h1>
      </header>

      <form onSubmit={handleCreate} style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: 18, display: "grid", gap: 14, padding: 18 }}>
        <label style={{ display: "grid", gap: 8 }}>
          Arama adı
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Ataşehir bebek arabası" style={inputStyle} />
        </label>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={{ display: "grid", gap: 8 }}>
            Arama metni
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Bebek arabası" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            Şehir
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="İstanbul" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            Sıralama
            <select value={sort} onChange={(event) => setSort(event.target.value)} style={inputStyle}>
              <option value="newest">En yeni</option>
              <option value="price_asc">Fiyat artan</option>
              <option value="price_desc">Fiyat azalan</option>
              <option value="relevance">Alaka düzeyi</option>
            </select>
          </label>
        </div>

        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Kaydediliyor..." : "Aramayı kaydet"}
        </button>
      </form>

      {error ? <section role="alert" style={{ border: "1px solid #f2b8b5", borderRadius: 14, padding: 14 }}>{error}</section> : null}
      {loadState === "loading" ? <p>Kayıtlı aramalar yükleniyor...</p> : null}

      {loadState !== "loading" && !hasItems ? (
        <section style={{ border: "1px dashed var(--color-border, #d7d7d7)", borderRadius: 18, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Henüz takip ettiğin bir arama yok</h2>
          <p>Aradığın ürün, şehir ve sıralama kriterlerini kaydettiğinde burada görünür.</p>
        </section>
      ) : null}

      {hasItems ? (
        <section aria-label="Kayıtlı aramalar" style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: 16, display: "flex", gap: 12, justifyContent: "space-between", padding: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>{item.name}</h2>
                <p style={{ margin: "6px 0 0", opacity: 0.72 }}>{[item.filters.q, item.filters.city, item.filters.sort].filter(Boolean).join(" · ") || "Filtre yok"}</p>
                <p style={{ margin: "6px 0 0", opacity: 0.72 }}>Bildirim tercihi: {item.notificationEnabled ? "Açık" : "Ayarlar’dan yönetilebilir"}</p>
              </div>
              <button type="button" onClick={() => void handleDelete(item.id)}>Sil</button>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
