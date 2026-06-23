"use client";

import { useEffect, useState } from "react";

type AdminNotificationOpsPreview = {
  summary: {
    totalDraftCandidates: number;
    childLifecycleCandidates: number;
    savedSearchCandidates: number;
    draftOnly: true;
  };
  deliveryPolicy: {
    sendEnabled: false;
    queueEnabled: false;
    emailEnabled: false;
    pushEnabled: false;
    n8nEnabled: false;
    dedupRequired: true;
    frequencyLimitRequired: true;
  };
  channels: Array<{
    key: "in_app" | "email_draft" | "push_future" | "n8n_future";
    label: string;
    status: "draft_only" | "future";
    note: string;
  }>;
  nextSteps: string[];
  warning: string;
};

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type NotificationOpsPageProps = {
  apiBaseUrl: string;
};

export function NotificationOpsPage({ apiBaseUrl }: NotificationOpsPageProps) {
  const [data, setData] = useState<AdminNotificationOpsPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/notifications/ops-preview`, {
          credentials: "include"
        });
        const payload = (await response.json()) as ApiResponse<AdminNotificationOpsPreview>;

        if (!isMounted) return;

        if (!payload.ok) {
          setErrorMessage(payload.error.message);
          setData(null);
          return;
        }

        setData(payload.data);
      } catch {
        if (isMounted) {
          setErrorMessage("Notification ops preview yüklenemedi.");
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
          Trust & Safety Ops
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Notification Ops Preview
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Çocuk lifecycle ve kayıtlı arama bildirim adaylarını operasyonel olarak izle. Bu ekran gönderim yapmaz;
          email, push, queue ve n8n bağlantıları kapalıdır.
        </p>
      </header>

      {isLoading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600">
          Notification ops preview yükleniyor...
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
              label="Toplam draft adayı"
              value={`${data.summary.totalDraftCandidates}`}
              description="Gerçek gönderim yok; yalnızca aday sayısı."
            />
            <MetricCard
              label="Child lifecycle"
              value={`${data.summary.childLifecycleCandidates}`}
              description="Aktif çocuk profili + cadence açık kayıtlar."
            />
            <MetricCard
              label="Saved search"
              value={`${data.summary.savedSearchCandidates}`}
              description="Bildirim tercihi açık kayıtlı aramalar."
            />
          </section>

          <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Delivery policy
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Gönderim kapalı, draft-only mod açık
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {data.warning}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PolicyItem label="Send enabled" value={data.deliveryPolicy.sendEnabled ? "Açık" : "Kapalı"} />
              <PolicyItem label="Queue enabled" value={data.deliveryPolicy.queueEnabled ? "Açık" : "Kapalı"} />
              <PolicyItem label="Email enabled" value={data.deliveryPolicy.emailEnabled ? "Açık" : "Kapalı"} />
              <PolicyItem label="n8n enabled" value={data.deliveryPolicy.n8nEnabled ? "Açık" : "Kapalı"} />
              <PolicyItem label="Dedup required" value={data.deliveryPolicy.dedupRequired ? "Gerekli" : "Kapalı"} />
              <PolicyItem label="Frequency limit" value={data.deliveryPolicy.frequencyLimitRequired ? "Gerekli" : "Kapalı"} />
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Channels
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Kanal durumu
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {data.channels.map((channel) => (
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={channel.key}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base font-black text-slate-950">{channel.label}</strong>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                      {channel.status === "draft_only" ? "Draft-only" : "Future"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {channel.note}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Next steps
            </p>
            <h2 className="text-xl font-black text-slate-950">
              Gerçek delivery öncesi yapılacaklar
            </h2>
            <ul className="grid gap-2 text-sm font-semibold leading-6 text-slate-600 md:grid-cols-2">
              {data.nextSteps.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ul>
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
      <strong className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
        {value}
      </strong>
    </div>
  );
}
