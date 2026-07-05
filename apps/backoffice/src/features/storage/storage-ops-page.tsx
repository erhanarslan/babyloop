"use client";

import { useEffect, useState } from "react";

type AdminStorageOpsPreview = {
  status: string;
  localStorageEnabled: true;
  externalStorageEnabled: false;
  storageProviderConfigured: false;
  s3Enabled: false;
  r2Enabled: false;
  signedUploadEnabled: false;
  publicBucketEnabled: false;
  cdnPurgeEnabled: false;
  queueEnabled: false;
  imageSafetyRequired: true;
  moderationQuarantineRequired: true;
  maxListingImages: number;
  allowedMimeTypes: string[];
  blockedOperations: string[];
  requirements: Array<{ key: string; label: string; status: string; requiredBeforeExternalStorage: true }>;
  migrationStages: Array<{ stage: string; status: string; note: string }>;
  privacyNote: string;
  warning: string;
};

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
};

export function StorageOpsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [data, setData] = useState<AdminStorageOpsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPreview() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/storage/ops-preview`, {
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          throw new Error(`Storage ops preview failed: ${response.status}`);
        }

        const payload = (await response.json()) as ApiResponse<AdminStorageOpsPreview>;
        if (!payload.data) {
          throw new Error(payload.error?.message ?? "Storage ops preview payload is missing.");
        }

        if (mounted) {
          setData(payload.data);
          setError(null);
        }
      } catch (cause) {
        if (mounted) {
          setError(cause instanceof Error ? cause.message : "Storage ops preview yüklenemedi.");
        }
      }
    }

    void loadPreview();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-black text-red-950">Storage Ops Preview</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-black text-slate-950">Storage Ops Preview</h1>
          <p className="mt-2 text-sm text-slate-600">Storage ops preview yükleniyor…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Storage operations</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Storage Ops Preview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Local-only storage readiness görünürlüğü. External storage provider disabled; S3/R2, signed upload, bucket delete,
          object copy, CDN purge ve queue worker kapalı.
        </p>
        <p className="mt-2 text-xs text-slate-500">{data.warning}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Local storage" value={data.localStorageEnabled ? 1 : 0} />
          <SummaryCard label="External storage" value={data.externalStorageEnabled ? 1 : 0} />
          <SummaryCard label="Signed upload" value={data.signedUploadEnabled ? 1 : 0} />
          <SummaryCard label="Queue worker" value={data.queueEnabled ? 1 : 0} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Required before external storage</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            {data.requirements.map((requirement) => (
              <div className="flex justify-between gap-3" key={requirement.key}>
                <span>{requirement.label}</span>
                <strong className="text-slate-950">{requirement.status}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Migration stages</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-600">
            {data.migrationStages.map((stage) => (
              <div key={stage.stage}>
                <strong className="text-slate-950">
                  {stage.stage}: {stage.status}
                </strong>
                <p className="mt-1">{stage.note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Privacy and blocked operations</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{data.privacyNote}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.blockedOperations.map((operation) => (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" key={operation}>
              {operation}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}
