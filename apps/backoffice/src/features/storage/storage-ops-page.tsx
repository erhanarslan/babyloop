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
          throw new Error("Depolama operasyon durumu alınamadı.");
        }

        if (mounted) {
          setData(payload.data);
        }
      } catch {
        if (mounted) {
          setError("Depolama operasyon durumu yüklenemedi. Yetkiyi ve API erişimini kontrol et.");
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
          <p className="eyebrow">Depolama Operasyonları</p>
          <h2>Depolama durum görünümü</h2>
          <p>
            S3/R2 ve imzalı yükleme hazırlığını gizli değer, imzalı URL, nesne anahtarı
            veya ham yükleme gövdesi göstermeden izle.
          </p>
        </div>
      </section>

      {isLoading ? <div className="state-panel">Depolama operasyon durumu yükleniyor…</div> : null}
      {error ? <div className="state-panel danger" role="alert">{error}</div> : null}

      {data ? (
        <>
          <section className="summary-grid dashboard-summary-grid" aria-label="Depolama operasyon özeti">
            <SummaryCard
              label="Görsel depolama"
              value={formatDriver(data.imageStorage.driver)}
              description={data.imageStorage.localFallback ? "Yerel yedek sürücü aktif." : "Dış nesne depolama sürücüsü seçili."}
            />
            <SummaryCard
              label="S3/R2 hazırlığı"
              value={data.imageStorage.s3Configured ? "Hazır" : "Eksik"}
              description={data.imageStorage.s3Configured ? "S3 uyumlu sağlayıcı için gerekli alanlar tamam." : "Dış kova veya sağlayıcı alanları eksik ya da kapalı."}
            />
            <SummaryCard
              label="Yükleme rotası"
              value={data.uploadRoute.localRouteEnabled ? "Açık" : "Kapalı"}
              description={data.uploadRoute.localRouteEnabled ? "API yükleme rotası yerel sürücü için aktif." : "Yerel yükleme rotası kapalı."}
            />
            <SummaryCard
              label="Herkese açık URL"
              value={data.imageStorage.publicBaseUrl ? "Tanımlı" : "Yok"}
              description={data.imageStorage.publicBaseUrl ? "Temel URL gizli değer içermeden tanımlı." : "Yerel yedek etkin veya dış yapılandırma eksik."}
            />
          </section>

          <section className="module-grid" aria-label="Depolama operasyon ayrıntıları">
            <article className="module-card">
              <div>
                <p className="eyebrow">Görsel depolama</p>
                <h3>Aktif medya sürücüsü</h3>
                <p>{data.warning}</p>
              </div>
              <dl className="detail-list">
                <DetailItem label="Sürücü" value={formatDriver(data.imageStorage.driver)} />
                <DetailItem label="Yerel yedek" value={data.imageStorage.localFallback ? "Açık" : "Kapalı"} />
                <DetailItem label="S3 yapılandırması" value={data.imageStorage.s3Configured ? "Tamam" : "Eksik"} />
                <DetailItem label="Herkese açık temel URL" value={data.imageStorage.publicBaseUrl ? safeHost(data.imageStorage.publicBaseUrl) : "Tanımlı değil"} />
              </dl>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Yükleme rotası</p>
                <h3>İlan görseli yükleme</h3>
                <p>{data.uploadRoute.note}</p>
              </div>
              <dl className="detail-list">
                <DetailItem label="Rota" value={data.uploadRoute.routePrefix} />
                <DetailItem label="Durum" value={data.uploadRoute.localRouteEnabled ? "Aktif" : "Kapalı"} />
                <DetailItem label="İmzalı URL" value="Bu uç noktada gösterilmez" />
                <DetailItem label="Nesne anahtarı" value="Bu uç noktada gösterilmez" />
              </dl>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Güvenlik sınırı</p>
                <h3>Gizlilik ve engellenen işlemler</h3>
                <p>
                  Bu ekran kova kimlik bilgisi, erişim anahtarı, imzalı URL, nesne anahtarı,
                  çerez, token, ham yükleme gövdesi veya kullanıcı görselini göstermez.
                </p>
              </div>
              <div className="metadata-chip-row">
                {["gizli değer yok", "imzalı URL yok", "nesne anahtarı yok", "ham yükleme yok", "token yok"].map((item) => (
                  <span className="metadata-chip" key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className="module-card">
              <div>
                <p className="eyebrow">Operasyon</p>
                <h3>Dış depolama öncesi gerekenler</h3>
                <p>
                  Bu sayfa yalnız görünürlük sağlar. Kova silme, nesne kopyalama, CDN
                  temizleme, tam Redis temizliği veya production veri geçişi işlemi başlatmaz.
                </p>
              </div>
              <div className="info-panel">
                <strong>Dış depolamaya geçiş</strong>
                <p>
                  Sağlayıcı yapılandırması hazır olmadan dış depolamaya geçiş yapılmaz. Gerekli kapılar:
                  provider_selection, private_bucket_policy, signed_upload_contract,
                  object_lifecycle_cleanup, migration_replay_plan ve queue_worker.
                </p>
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
  return driver === "s3" ? "S3/R2 uyumlu" : "Yerel";
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "Tanımlı";
  }
}
