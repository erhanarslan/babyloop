"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminProductAnalyticsEventName,
  type AdminProductAnalyticsSummary,
  getAdminProductAnalyticsSummary,
} from "./api";

export function ProductAnalyticsDashboard() {
  const [summary, setSummary] = useState<AdminProductAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSummary() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminProductAnalyticsSummary();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setSummary(null);
        setErrorMessage(
          getApiErrorMessage(response, "Ürün analitiği yüklenemedi."),
        );
        setIsLoading(false);
        return;
      }

      setSummary(response.data.summary);
      setIsLoading(false);
    }

    void loadSummary();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="content-card">
      <div className="page-toolbar">
        <div>
          <p className="eyebrow">Ürün Analitiği</p>
          <h2>Pazaryeri keşif sinyalleri</h2>
          <p>
            İlan görüntüleme, kategori gezintisi, arama sonuç kovaları ve son görüntülenen ürün
            tıklamaları için yalnız toplu görünürlük. Ham arama sorgusu, kullanıcı kimliği,
            e-posta, telefon, yönlendiren adres ve tarayıcı bilgisi gösterilmez.
          </p>
        </div>
        <Link className="secondary-action" href="/listings">
          İlanlara git
        </Link>
      </div>

      {isLoading ? <div className="state-panel">Ürün analitiği yükleniyor…</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Ürün analitiği özeti">
            <SummaryCard label="Olay 24 saat" value={summary.totals.eventsLast24Hours} />
            <SummaryCard label="Olay 7 gün" value={summary.totals.eventsLast7Days} />
            <SummaryCard label="Detay görüntüleme 7g" value={summary.totals.listingDetailViewsLast7Days} />
            <SummaryCard label="İlan tıklama 7g" value={summary.totals.listingCardClicksLast7Days} />
            <SummaryCard
              label="Öneri gösterimi 7g"
              value={summary.totals.recommendationImpressionsLast7Days}
            />
            <SummaryCard
              label="Öneri tıklama 7g"
              value={summary.totals.recommendationClicksLast7Days}
            />
            <SummaryCard
              label="Öneri tıklama oranı 7g"
              value={`${summary.totals.recommendationClickRateLast7Days}%`}
            />
            <SummaryCard
              label="İletişim niyeti 7g"
              value={summary.totals.contactSellerIntentsLast7Days}
            />
            <SummaryCard
              label="Detay → iletişim 7g"
              value={`${summary.totals.detailToContactIntentRateLast7Days}%`}
            />
            <SummaryCard label="Kategori 7g" value={summary.totals.categoryViewsLast7Days} />
            <SummaryCard label="Arama 7g" value={summary.totals.searchesLast7Days} />
            <SummaryCard label="Son görüntülenen 7g" value={summary.totals.recentlyViewedClicksLast7Days} />
            <SummaryCard label="Toplam olay" value={summary.totals.totalEvents} />
          </section>

          <section className="module-grid" aria-label="Ürün analitiği kırılımları">
            <article className="module-card dashboard-module-card">
              <h3>Olay kırılımı</h3>
              <p>Gizliliği koruyan olay türlerine göre toplam ürün olayı.</p>
              <dl className="compact-details">
                {summary.eventCounts.length === 0 ? (
                  <div className="state-panel">Henüz ürün olayı yok.</div>
                ) : (
                  summary.eventCounts.map((item) => (
                    <div key={item.eventType}>
                      <dt>{formatEventName(item.eventType)}</dt>
                      <dd>{item.count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Kaynak kırılımı</h3>
              <p>Gezinme, kategori, ilan detayı ve son görüntülenenler gibi olay yüzeyleri.</p>
              <dl className="compact-details">
                {summary.sourceCounts.length === 0 ? (
                  <div className="state-panel">Henüz kaynak verisi yok.</div>
                ) : (
                  summary.sourceCounts.map((item) => (
                    <div key={item.source}>
                      <dt>{formatSource(item.source)}</dt>
                      <dd>{item.count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>Arama sonuç kovaları</h3>
              <p>Ham arama terimi saklamadan sonuç sayısı aralıklarına göre arama etkinliği.</p>
              <dl className="compact-details">
                {summary.searchResultBuckets.length === 0 ? (
                  <div className="state-panel">Henüz arama olayı yok.</div>
                ) : (
                  summary.searchResultBuckets.map((item) => (
                    <div key={item.resultBucket}>
                      <dt>{item.resultBucket}</dt>
                      <dd>{item.count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>En çok görüntülenen kategoriler 7g</h3>
              <p>Açık kategori görüntüleme olayı alan kategoriler.</p>
              <div className="table-list">
                {summary.topCategories.length === 0 ? (
                  <div className="state-panel">Henüz kategori görüntüleme olayı yok.</div>
                ) : (
                  summary.topCategories.map((category) => (
                    <div className="table-list-row" key={category.categoryId}>
                      <div>
                        <strong>{category.categoryName}</strong>
                        <p className="muted">{category.categorySlug}</p>
                      </div>
                      <small className="muted">{category.viewCount} görüntüleme</small>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="module-card dashboard-module-card">
              <h3>En çok etkileşim alan ilanlar 7g</h3>
              <p>En çok ürün etkileşimi alan ilanlar.</p>
              <div className="table-list">
                {summary.topListings.length === 0 ? (
                  <div className="state-panel">Henüz ilan etkileşimi olayı yok.</div>
                ) : (
                  summary.topListings.map((listing) => (
                    <div className="table-list-row" key={listing.listingId}>
                      <div>
                        <strong>{listing.title}</strong>
                        <p className="muted">
                          {listing.categoryName} · {listing.categorySlug}
                        </p>
                      </div>
                      <small className="muted">{listing.eventCount} olay</small>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatEventName(eventType: AdminProductAnalyticsEventName): string {
  const labels: Record<AdminProductAnalyticsEventName, string> = {
    assistant_message_sent: "Asistan mesajı",
    cart_cleared: "Sepet temizlendi",
    cart_item_added: "Sepete eklendi",
    cart_item_removed: "Sepetten çıkarıldı",
    category_viewed: "Kategori görüntülendi",
    contact_seller_intent: "Satıcıyla iletişim niyeti",
    listing_card_clicked: "İlan kartı tıklandı",
    listing_detail_viewed: "İlan detayı görüntülendi",
    listing_recommendation_impression: "Öneri gösterimi",
    mock_checkout_failed: "Ödeme denemesi başarısız",
    mock_checkout_succeeded: "Ödeme denemesi başarılı",
    recently_viewed_listing_clicked: "Son görüntülenen ilan tıklandı",
    search_performed: "Arama yapıldı"
  };

  return labels[eventType];
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    assistant: "Asistan",
    browse: "Gezinme",
    cart: "Sepet",
    category: "Kategori",
    category_landing: "Kategori açılışı",
    home: "Ana sayfa",
    listing_detail: "İlan detayı",
    listing_grid: "İlan ızgarası",
    marketplace: "Pazaryeri",
    recommendations: "Öneriler",
    recently_viewed: "Son görüntülenenler",
    search: "Arama"
  };

  return labels[source] ?? source.replace(/_/gu, " ");
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Ürün analitiğini görüntüleme yetkin yok."
    : fallback;
}
