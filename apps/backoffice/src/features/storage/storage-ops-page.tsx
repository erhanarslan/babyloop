"use client";

import { useEffect, useState } from "react";

type AdminStorageOpsPreview = {
  imageStorage: {
    driver: "local" | "s3";
    localFallback: boolean;
    publicBaseUrl: string | null;
    s3Configured: boolean;
  };
  uploadRoute: {
    localRouteEnabled: true;
    routePrefix: "/api/v1/uploads/listings";
    note: string;
  };
  warning: string;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type StorageOpsPageProps = {
  apiBaseUrl: string;
};

export function StorageOpsPage({ apiBaseUrl }: StorageOpsPageProps) {
  const [data, setData] = useState<AdminStorageOpsPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/storage/ops-preview`, {
          credentials: "include"
        });
        const payload = (await response.json()) as ApiResponse<AdminStorageOpsPreview>;

        if (!isMounted) return;

        if (!payload.ok) {
          setErrorMessage(payload.error.message);
          setData(null);
          return;
        }

        setData(payload.data);
      } catch {
        if (isMounted) {
          setErrorMessage("Storage ops preview yüklenemedi.");
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Marketplace Ops
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Storage Ops Preview
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          İlan görsel storage driver durumunu güvenli şekilde izle. Bu ekran credential, secret veya raw image binary göstermez.
        </p>
      </header>

      {isLoading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600">
          Storage ops preview yükleniyor...
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
          {errorMessage}
        </section>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Driver"
              value={data.imageStorage.driver.toUpperCase()}
              description={data.imageStorage.driver === "local" ? "Local upload route aktif." : "S3/R2 public URL modu."}
            />
            <MetricCard
              label="S3 configured"
              value={data.imageStorage.s3Configured ? "Evet" : "Hayır"}
              description="Credential gösterilmez; sadece eksiksiz config durumu."
            />
            <MetricCard
              label="Local fallback"
              value={data.imageStorage.localFallback ? "Açık" : "Kapalı"}
              description="Env yoksa local driver ile mevcut davranış korunur."
            />
          </section>

          <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Image storage
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Aktif görsel saklama modu
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {data.warning}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PolicyItem label="Driver" value={data.imageStorage.driver} />
              <PolicyItem label="Public base URL" value={data.imageStorage.publicBaseUrl ?? "local route"} />
              <PolicyItem label="S3/R2 configured" value={data.imageStorage.s3Configured ? "configured" : "not configured"} />
              <PolicyItem label="Local fallback" value={data.imageStorage.localFallback ? "enabled" : "disabled"} />
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Upload route
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Local upload route boundary
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {data.uploadRoute.note}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Route prefix
              </p>
              <code className="mt-2 block overflow-x-auto rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-800">
                {data.uploadRoute.routePrefix}
              </code>
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-black text-amber-950">
              Production notu
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-amber-900">
              Production ortamında local driver kalıcı storage değildir. Beta deploy öncesi S3/R2 bucket,
              public CDN domain ve secret yönetimi env üzerinden tamamlanmalıdır.
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({
  description,
  label,
  value
}: {
  description: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <strong className="mt-2 block text-3xl font-black text-slate-950">{value}</strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <strong className="max-w-[70%] truncate rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
        {value}
      </strong>
    </div>
  );
}
