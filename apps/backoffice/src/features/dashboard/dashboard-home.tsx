"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type AdminDashboardSummary,
  getAdminDashboardSummary,
} from "./api";
import { useBackofficeAccess } from "../auth/backoffice-access";

export function DashboardHome() {
  const access = useBackofficeAccess();

  if (access.accessMode === "preview") {
    return <PreviewDashboardHome />;
  }

  return <StaffDashboardHome />;
}

function PreviewDashboardHome() {
  return (
    <div className="admin-page-stack">
      <section className="page-heading">
        <p className="eyebrow">BabyLoop Backoffice</p>
        <h2>Ürün tanıtım görünümü</h2>
        <p>
          BabyLoop pazaryeri deneyimini güvenli, salt okunur bilgilerle inceleyebilirsin.
          İstatistikler, operasyon verileri ve yönetim işlemleri bu görünümde kapalıdır.
        </p>
      </section>

      <section className="module-grid preview-module-grid" aria-label="Tanıtım bölümleri">
        <PreviewModule
          description="İlanların güvenli özetlerini ve herkese açık ürün bilgilerini incele."
          href="/listings"
          title="İlanları keşfet"
        />
        <PreviewModule
          description="Hassas bilgiler olmadan temel profil kimliği, şehir ve ilan sayısını görüntüle."
          href="/profiles"
          title="Profil dizinini incele"
        />
      </section>
    </div>
  );
}

function PreviewModule({
  description,
  href,
  title
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link className="module-card preview-module-card" href={href}>
      <h3>{title}</h3>
      <p>{description}</p>
      <span>Salt okunur görüntüle</span>
    </Link>
  );
}

function StaffDashboardHome() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSummary() {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await getAdminDashboardSummary();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setSummary(null);
        setErrorMessage(
          getApiErrorMessage(response, "Yönetim paneli özeti yüklenemedi."),
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
    <>
      <section className="page-heading">
        <p className="eyebrow">BabyLoop Operasyonları</p>
        <h2>Güven ve emniyet izleme paneli</h2>
        <p>
          Moderasyon, pazar yeri, konuşmalar, profiller, denetim ve AI sağlığı için
          yalnız toplu operasyon görünümü sunulur. Satıcı, şikâyetçi, ileti gövdesi,
          e-posta, telefon veya ham AI verisi gösterilmez.
        </p>
      </section>

      {isLoading ? <div className="state-panel">Panel yükleniyor…</div> : null}

      {errorMessage ? (
        <div className="state-panel danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Panel özeti">
            <SummaryCard label="Açık vakalar" value={summary.moderation.openModerationCases} />
            <SummaryCard label="Yüksek öncelik" value={summary.moderation.openHighPriorityCases} />
            <SummaryCard label="Bekleyen şikâyetler" value={summary.moderation.pendingReports} />
            <SummaryCard label="İncelenecek profiller" value={summary.profiles.profilesNeedingReview} />
            <SummaryCard label="Açık mesaj vakaları" value={summary.conversations.openMessageCases} />
            <SummaryCard label="7 günlük AI hatası" value={summary.ai.moderationSummaryFailuresLast7Days} />
            <SummaryCard label="İncelenecek görseller" value={summary.images.needsReviewListingImages} />
            <SummaryCard label="7 günlük denetim kaydı" value={summary.actions.auditEventsLast7Days} />
          </section>

          <section className="module-grid" aria-label="Yönetim paneli modülleri">
            <DashboardModule
              href="/moderation"
              title="Moderasyon kuyruğu"
              description="Açık vakaları, öncelik dağılımını, gelen şikâyetleri ve hassas erişim hareketlerini izle."
              stats={[
                ["Açık vakalar", summary.moderation.openModerationCases],
                ["Yüksek öncelik", summary.moderation.openHighPriorityCases],
                ["Normal öncelik", summary.moderation.openNormalPriorityCases],
                ["Düşük öncelik", summary.moderation.openLowPriorityCases],
                ["7 günlük yeni vaka", summary.moderation.casesCreatedLast7Days],
                ["7 günlük şikâyet", summary.moderation.reportsCreatedLast7Days],
              ]}
            />
            <DashboardModule
              href="/profiles"
              title="Profil risk kuyruğu"
              description="Kısıtlı, askıya alınmış, yüksek ve kritik riskli profilleri izle."
              stats={[
                ["İnceleme gerekli", summary.profiles.profilesNeedingReview],
                ["Kısıtlı", summary.profiles.restrictedProfiles],
                ["Askıya alınmış", summary.profiles.suspendedProfiles],
                ["Yüksek risk", summary.profiles.highRiskProfiles],
                ["Kritik risk", summary.profiles.criticalRiskProfiles],
              ]}
            />
            <DashboardModule
              href="/conversations"
              title="Mesaj güvenliği"
              description="Ham ileti gövdelerini göstermeden toplu konuşma ve mesaj riskini incele."
              stats={[
                ["Toplam konuşma", summary.conversations.totalConversations],
                ["7 günlük yeni konuşma", summary.conversations.conversationsCreatedLast7Days],
                ["7 günlük mesaj", summary.conversations.messagesCreatedLast7Days],
                ["Şikâyet edilen mesajlar", summary.conversations.reportedMessageCount],
                ["Açık mesaj vakaları", summary.conversations.openMessageCases],
                ["7 günlük mesaj işlemi", summary.actions.messageEnforcementActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/listings"
              title="Pazar yeri incelemesi"
              description="İlan hacmini, yaşam döngüsü durumunu ve görsel inceleme kuyruğunu izle."
              stats={[
                ["Toplam ilan", summary.listings.totalListings],
                ["Aktif ilanlar", summary.listings.activeListings],
                ["7 günde oluşturulan", summary.listings.listingsCreatedLast7Days],
                ["7 günde güncellenen", summary.listings.listingsUpdatedLast7Days],
                ["Reddedilen görselli", summary.listings.listingsWithRejectedImages],
                ["7 günlük ilan işlemi", summary.actions.listingActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/listings"
              title="Görsel incelemesi"
              description="Onaylanan, inceleme bekleyen ve reddedilen ilan görselleriyle son işlem hacmini izle."
              stats={[
                ["Toplam görsel", summary.images.totalListingImages],
                ["Onaylandı", summary.images.approvedListingImages],
                ["İnceleme gerekli", summary.images.needsReviewListingImages],
                ["Reddedildi", summary.images.rejectedListingImages],
                ["7 günde incelenen", summary.images.imagesReviewedLast7Days],
                ["7 günlük görsel işlemi", summary.actions.imageReviewActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/audit"
              title="Denetim ve hassas erişim"
              description="Denetlenen yönetici hareketlerini yalnız toplu düzeyde izle."
              stats={[
                ["7 günlük denetim kaydı", summary.actions.auditEventsLast7Days],
                ["7 günlük hassas erişim izni", summary.moderation.sensitiveAccessGrantedLast7Days],
                ["7 günlük hassas erişim reddi", summary.moderation.sensitiveAccessDeniedLast7Days],
                ["7 günlük profil işlemi", summary.actions.profileEnforcementActionsLast7Days],
              ]}
            />
            <DashboardModule
              href="/ai-ops"
              title="AI moderasyon sağlığı"
              description="Ham istem veya çıktıları göstermeden AI moderasyon özeti kullanımını ve hata sinyallerini izle."
              stats={[
                ["7 günlük özet çalışması", summary.ai.moderationSummaryRunsLast7Days],
                ["7 günlük hata", summary.ai.moderationSummaryFailuresLast7Days],
                ["7 günlük sağlayıcı hatası", summary.ai.providerFailuresLast7Days],
                ["7 günlük doğrulama hatası", summary.ai.validationFailuresLast7Days],
              ]}
            />
          </section>
        </>
      ) : null}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DashboardModule({
  description,
  href,
  stats,
  title,
}: {
  description: string;
  href: string;
  stats: Array<[string, number]>;
  title: string;
}) {
  return (
    <Link className="module-card dashboard-module-card" href={href}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <dl className="compact-details">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function getApiErrorMessage(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.ok) {
    return fallback;
  }

  return response.error?.code === "FORBIDDEN"
    ? "Bu yönetim panelini görüntüleme yetkin yok."
    : fallback;
}
