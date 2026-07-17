"use client";

import { useEffect, useState } from "react";

type ImageStorageDriver = "local" | "s3";

type AdminStorageOpsPreview = {
  imageStorage: {
    driver: ImageStorageDriver;
    localFallback: boolean;
    publicBaseUrl: string | null;
    s3Configured: boolean;
  };
  uploadRoute: {
    localRouteEnabled: boolean;
    routePrefix: string;
    note: string;
  };
  warning: string;
};

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

export function StorageOpsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [data, setData] = useState<AdminStorageOpsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadPreview() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/storage/ops-preview`, {
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        });
        const payload = (await response.json()) as ApiResponse<AdminStorageOpsPreview>;

        if (!response.ok || payload.ok === false || !payload.data) {
          throw new Error(payload.error?.message ?? `Storage ops preview failed: ${response.status}`);
        }

        if (mounted) {
          setData(payload.data);
        }
      } catch {
        if (mounted) {
          setError("Storage operasyon durumu yüklenemedi. Yetkiyi, API erişimini ve storage ops endpoint’ini kontrol et.");
          setData(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  return (
    <div className="dashboard-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Storage Operasyonları</p>
          <h2>Güvenli dosya ve medya görünürlüğü</h2>
          <p>
            Aktif image storage driver’ını, upload route davranışını ve dış storage readiness durumunu
            secret, signed URL, object key veya raw upload gövdesi göstermeden izle.
          </p>
        </div>
      </section>

      {isLoading ? <div className="state-panel">Storage operasyon durumu yükleniyor...</div> : null}
      {error ? <div className="state-panel danger" role="alert">{error}</div> : null}

      {data ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Storage operasyon özeti">
            <SummaryCard
              label="Image storage"
              value={formatDriver(data.imageStorage.driver)}
              description={data.imageStorage.localFallback ? "Local fallback aktif." : "Dış object storage driver’ı seçili."}
            />
            <SummaryCard
              label="S3/R2 readiness"
              value={data.imageStorage.s3Configured ? "Hazır" : "Eksik"}
              description={data.imageStorage.s3Configured ? "S3 uyumlu provider için gerekli alanlar tamam." : "Dış bucket/provider alanları eksik veya kapalı."}
            />
            <SummaryCard
              label="Upload route"
              value={data.uploadRoute.localRouteEnabled ? "Açık" : "Kapalı"}
              description={data.uploadRoute.localRouteEnabled ? "API upload route’u local driver için aktif." : "Local upload route’u kapalı."}
            />
            <SummaryCard
              label="Public URL"
              value={data.imageStorage.publicBaseUrl ? "Tanımlı" : "Yok"}
              description={data.imageStorage.publicBaseUrl ? "Base URL secret içermeyen değer olarak tanımlı." : "Local fallback veya eksik external config."}
            />
          </section>

          <section className="module-grid" aria-label="Storage operasyon detayları">
            <article className="module-card">
              <div>
                <p className="eyebrow">Image storage</p>
                <h3>Aktif medya driver’ı</h3>
                <p>{data.warning}</p>
              </div>
              <dl className="detail-list">
                <DetailItem label="Driver" value={formatDriver(data.imageStorage.driver)} />
                <DetailItem label="Local fallback" value={data.imageStorage.localFallback ? "Açık" : "Kapalı"} />
                <DetailItem label="S3 configured" value={data.imageStorage.s3Configured ? "Tamam" : "Eksik"} />
                <DetailItem label="Public base URL" value={data.imageStorage.publicBaseUrl ? safeHost(data.imageStorage.publicBaseUrl) : "Tanımlı değil"} />
              </dl>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Upload route</p>
                <h3>Listing image upload</h3>
                <p>{data.uploadRoute.note}</p>
              </div>
              <dl className="detail-list">
                <DetailItem label="Route" value={data.uploadRoute.routePrefix} />
                <DetailItem label="Durum" value={data.uploadRoute.localRouteEnabled ? "Aktif" : "Kapalı"} />
                <DetailItem label="Signed URL" value="Bu endpoint’te gösterilmez" />
                <DetailItem label="Object key" value="Bu endpoint’te gösterilmez" />
              </dl>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Güvenlik sınırı</p>
                <h3>Gösterilmeyen alanlar</h3>
                <p>
                  Bu ekran bucket credential, access key, signed URL, object key, cookie, token, raw upload body
                  veya kullanıcıya ait görsel içeriği render etmez.
                </p>
              </div>
              <div className="metadata-chip-row">
                {["secret yok", "signed URL yok", "object key yok", "raw upload yok", "token yok"].map((item) => (
                  <span className="metadata-chip" key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Operasyon</p>
                <h3>Kontrollü davranış</h3>
                <p>
                  Bu sayfa yalnızca görünürlük sağlar. Bucket delete, object copy, CDN purge, full Redis flush veya
                  production migration aksiyonu başlatmaz.
                </p>
              </div>
              <div className="info-panel">
                <strong>Dış storage geçişi</strong>
                <p>Provider config hazır olmadan dış storage’a geçiş yapılmaz; migration ve rollback CLI/ops planı gerektirir.</p>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function formatDriver(driver: ImageStorageDriver): string {
  return driver === "s3" ? "S3/R2 uyumlu" : "Local";
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "Tanımlı";
  }
}
