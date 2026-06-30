"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  EmptyState,
  LoadingBlock,
  PageContainer
} from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  fetchSellerDashboard,
  type SellerDashboardSummary
} from "./api";

type SellerDashboardPageContentProps = {
  apiBaseUrl: string;
};

type SellerSection = "summary" | "performance" | "messages" | "favorites" | "settings";

const sellerSections: Array<{ id: SellerSection; label: string }> = [
  { id: "summary", label: "Özet" },
  { id: "performance", label: "İlan performansı" },
  { id: "messages", label: "Mesajlar" },
  { id: "favorites", label: "Favoriler" },
  { id: "settings", label: "Ayarlar" }
];

export function SellerDashboardPageContent({ apiBaseUrl }: SellerDashboardPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth, isAuthenticated } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: () => {
      setSummary(null);
      setIsLoading(false);
    }
  });
  const [activeSection, setActiveSection] = useState<SellerSection>("summary");
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isCheckingAuth || !isAuthenticated) {
      return;
    }

    let isActive = true;

    async function loadSellerDashboard() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await fetchSellerDashboard(apiBaseUrl);

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setErrorMessage(getApiErrorMessage(response.error as ApiError, dictionary));
        setSummary(null);
        setIsLoading(false);
        return;
      }

      setSummary(response.data.summary);
      setIsLoading(false);
    }

    void loadSellerDashboard();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, isAuthenticated, isCheckingAuth]);

  const sortedListings = useMemo(
    () => (summary ? sortSellerListings(summary.listings) : []),
    [summary]
  );

  return (
    <PageContainer className="pb-12 pt-5" ariaLabel="Satıcı paneli">
      <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="self-start rounded-[1.25rem] border border-border/70 bg-muted/25 p-3">
          <nav aria-label="Satıcı paneli bölümleri" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {sellerSections.map((section) => (
              <button
                aria-pressed={activeSection === section.id}
                className={[
                  "min-w-[160px] rounded-2xl border px-3 py-2 text-left text-sm font-black transition lg:min-w-0",
                  activeSection === section.id
                    ? "border-primary/40 bg-background text-primary shadow-sm"
                    : "border-transparent text-foreground hover:bg-background/75"
                ].join(" ")}
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="grid min-w-0 gap-4">
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Satıcı paneli</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                İlanlarını ve temel satıcı sinyallerini takip et.
              </p>
            </div>
            <Link className="inline-flex rounded-full bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground" href="/sell">
              İlan ver
            </Link>
          </div>

          {errorMessage ? <Alert title="Satıcı paneli yüklenemedi" message={errorMessage} /> : null}

          {isCheckingAuth || (isAuthenticated && isLoading) ? (
            <LoadingBlock title="Satıcı paneli yükleniyor" message="İlan özetleri hazırlanıyor." />
          ) : null}

          {summary && activeSection === "summary" ? <SummaryPanel summary={summary} /> : null}
          {summary && activeSection === "performance" ? (
            <PerformancePanel listings={sortedListings} />
          ) : null}
          {summary && activeSection === "messages" ? <SimpleLinkPanel href="/conversations" title="Mesajlar" body="Alıcı sorularını mesajlar sayfasında takip et." action="Mesajlara git" /> : null}
          {summary && activeSection === "favorites" ? <FavoritesPanel summary={summary} /> : null}
          {summary && activeSection === "settings" ? <SimpleLinkPanel href="/my-listings" title="Ayarlar" body="İlan durumu ve görünürlüğünü İlanlarım sayfasından yönet." action="İlanlarımı aç" /> : null}
        </div>
      </section>
    </PageContainer>
  );
}

function SummaryPanel({ summary }: { summary: SellerDashboardSummary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Satıcı özeti">
      <MetricCard label="Aktif ilan" value={summary.totals.activeListings} />
      <MetricCard label="Gelen mesaj" value={summary.totals.contactSellerIntents} />
      <MetricCard label="Toplam favori" value={summary.totals.totalFavorites} />
      <MetricCard label="Satıldı / rezerve" value={summary.totals.soldListings + summary.totals.reservedListings} />
    </section>
  );
}

function PerformancePanel({
  listings
}: {
  listings: SellerDashboardSummary["listings"];
}) {
  if (listings.length === 0) {
    return (
      <EmptyState
        title="Henüz ilan yok"
        message="İlan oluşturduğunda performans özeti burada görünür."
        actionHref="/sell"
        actionLabel="İlan ver"
      />
    );
  }

  return (
    <section className="grid gap-3" aria-label="İlan performansı">
      {listings.map((listing) => (
        <article className="rounded-[1.25rem] border border-border/70 bg-background p-4" key={listing.listingId}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground">{listing.categoryName}</p>
              <h2 className="text-lg font-black text-foreground">{listing.title}</h2>
            </div>
            <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
              {formatDashboardStatus(listing.status)}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            <MetricFact label="Favori" value={listing.favoriteCount} />
            <MetricFact label="Detay görüntüleme" value={listing.detailViews} />
            <MetricFact label="Tıklama" value={listing.listingClicks} />
            <MetricFact label="Mesaj niyeti" value={listing.contactSellerIntents} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm font-black text-foreground" href="/my-listings">
              Yönet
            </Link>
            <Link className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm font-black text-foreground" href={`/listings/${listing.listingId}`}>
              Detay
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}

function FavoritesPanel({ summary }: { summary: SellerDashboardSummary }) {
  return (
    <SimpleLinkPanel
      action="Favorileri aç"
      body={`İlanların toplam ${summary.totals.totalFavorites} kez favorilere eklendi.`}
      href="/favorites"
      title="Favoriler"
    />
  );
}

function SimpleLinkPanel({
  action,
  body,
  href,
  title
}: {
  action: string;
  body: string;
  href: string;
  title: string;
}) {
  return (
    <section className="rounded-[1.25rem] border border-border/70 bg-background p-4">
      <h2 className="text-xl font-black text-foreground">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{body}</p>
      <Link className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground" href={href}>
        {action}
      </Link>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[1.25rem] border border-border/70 bg-background p-4">
      <span className="text-sm font-black text-muted-foreground">{label}</span>
      <strong className="mt-2 block text-3xl font-black text-foreground">{value}</strong>
    </article>
  );
}

function MetricFact({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-black text-muted-foreground">{label}</dt>
      <dd className="font-black text-foreground">{value}</dd>
    </div>
  );
}

function sortSellerListings(
  listings: SellerDashboardSummary["listings"]
): SellerDashboardSummary["listings"] {
  return [...listings].sort((left, right) => right.favoriteCount - left.favoriteCount);
}

function formatDashboardStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "Aktif",
    archived: "Arşiv",
    reserved: "Rezerve",
    sold: "Satıldı"
  };

  return labels[status] ?? status;
}
