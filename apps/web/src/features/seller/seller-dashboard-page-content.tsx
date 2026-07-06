"use client";

import { useCallback, useEffect, useState } from "react";
import { getSellerDashboard, updateListingStatus, type SellerDashboard, type SellerDashboardListing } from "./seller-dashboard-api";

type LoadState = "idle" | "loading" | "ready" | "error";

const statusLabels: Record<SellerDashboardListing["status"], string> = {
  active: "Aktif",
  reserved: "Rezerve",
  sold: "Satıldı",
  archived: "Arşiv"
};

function nextActions(status: SellerDashboardListing["status"]): Array<SellerDashboardListing["status"]> {
  if (status === "archived") {
    return ["active"];
  }

  if (status === "sold") {
    return [];
  }

  return ["reserved", "sold", "archived"];
}

export function SellerDashboardPageContent() {
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setError(null);

    try {
      setDashboard(await getSellerDashboard());
      setLoadState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Satıcı paneli yüklenemedi.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleStatus(listing: SellerDashboardListing, status: SellerDashboardListing["status"]) {
    setBusyListingId(listing.id);
    setError(null);

    try {
      const updated = await updateListingStatus(listing.id, status);
      setDashboard((current) => {
        if (!current) {
          return current;
        }

        const listings = current.listings.map((item) => item.id === listing.id ? { ...item, ...updated, status } : item);

        return {
          ...current,
          listings,
          counts: listings.reduce<SellerDashboard["counts"]>(
            (counts, item) => {
              counts[item.status] += 1;
              return counts;
            },
            { active: 0, reserved: 0, sold: 0, archived: 0 }
          )
        };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "İlan durumu güncellenemedi.");
    } finally {
      setBusyListingId(null);
    }
  }

  return (
    <main style={{ display: "grid", gap: 24, margin: "0 auto", maxWidth: 1100, padding: 24 }}>
      <header>
        <p style={{ margin: 0, opacity: 0.72 }}>İlanlarını ve durum geçişlerini tek yerden yönet.</p>
        <h1 style={{ margin: "6px 0 0" }}>Satıcı paneli</h1>
      </header>

      {error ? <section role="alert" style={{ border: "1px solid #f2b8b5", borderRadius: 14, padding: 14 }}>{error}</section> : null}
      {loadState === "loading" ? <p>Satıcı paneli yükleniyor...</p> : null}

      {dashboard ? (
        <>
          <section aria-label="İlan durum özetleri" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            {(["active", "reserved", "sold", "archived"] as const).map((status) => (
              <article key={status} style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: 16, padding: 16 }}>
                <strong>{statusLabels[status]}</strong>
                <p style={{ fontSize: 28, margin: "8px 0 0" }}>{dashboard.counts[status]}</p>
              </article>
            ))}
          </section>

          {dashboard.listings.length === 0 ? (
            <section style={{ border: "1px dashed var(--color-border, #d7d7d7)", borderRadius: 18, padding: 24 }}>
              <h2 style={{ marginTop: 0 }}>Henüz ilanın yok</h2>
              <p>İlan verdiğinde durumlarını buradan yönetebilirsin.</p>
            </section>
          ) : (
            <section aria-label="İlanlarım" style={{ display: "grid", gap: 12 }}>
              {dashboard.listings.map((listing) => (
                <article key={listing.id} style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: 16, display: "grid", gap: 10, padding: 16 }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{listing.title}</h2>
                    <p style={{ margin: "6px 0 0", opacity: 0.72 }}>Durum: {statusLabels[listing.status]}{listing.city ? ` · ${listing.city}` : ""}</p>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {nextActions(listing.status).map((status) => (
                      <button key={status} disabled={busyListingId === listing.id} type="button" onClick={() => void handleStatus(listing, status)}>
                        {status === "active" ? "Aktife al" : `${statusLabels[status]} yap`}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}
