// Boundary guard phrase: provider secret must never be rendered in notification ops UI.
"use client";

import type { ApiResponse } from "@babyloop/shared";
import { useEffect, useState } from "react";

const DELIVERY_LOG_PRIVACY_BOUNDARY_NOTE =
  "Ops preview uses aggregate counts, provider status, redacted sourceRef, and redacted refs only; metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, provider credential and raw body are never exposed.";

type AdminNotificationOpsPreview = {
  summary: {
    status: "draft_only";
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
  policyPreview: {
    sendEnabled: false;
    draftOnly: true;
    defaultFrequencyWindowHours: number;
    childLifecycleFrequencyWindowHours: number;
    savedSearchFrequencyWindowHours: number;
    requiredBeforeSend: string[];
  };
  transitionPreview: {
    draftOnly: true;
    deliveryAllowed: false;
    allowedDraftOnlyTransitions: Array<{ from: string; to: string; reason: string }>;
    futureSenderTransitions: Array<{ from: string; to: string; blockedUntil: string[] }>;
    terminalStatuses: string[];
    privacyNote: string;
  };
  pushReadinessPreview: {
    status: string;
    deliveryAllowed: false;
    draftOnly: true;
    pushSenderEnabled: false;
    providerConfigured: false;
    tokenRegistryEnabled: boolean;
    tokenCollectionAllowed: false;
    consentRequired: true;
    auditRequired: true;
    idempotencyRequired: true;
    rateLimitRequired: true;
    requirements: Array<{ key: string; label: string; status: string; requiredBeforeSend: true }>;
    blockedReasons: string[];
    rolloutStages: Array<{ stage: string; status: string; note: string }>;
    warning: string;
  };
  n8nReadinessPreview: {
    status: string;
    deliveryAllowed: false;
    draftOnly: true;
    n8nWorkflowEnabled: false;
    webhookConfigured: false;
    webhookCallsAllowed: false;
    queueEnabled: false;
    retryEnabled: false;
    idempotencyRequired: true;
    auditRequired: true;
    rateLimitRequired: true;
    consentRequired: true;
    requirements: Array<{ key: string; label: string; status: string; requiredBeforeWebhook: true }>;
    workflowCandidates: Array<{ key: string; label: string; status: string; note: string }>;
    blockedReasons: string[];
    rolloutStages: Array<{ stage: string; status: string; note: string }>;
    warning: string;
  };
  preferenceSummary?: {
    deliveryProvidersEnabled: false;
    providerCallsAllowed: false;
    supportedSources: string[];
    supportedChannels: string[];
    defaultEnabledChannels: string[];
    draftOnlyChannels: string[];
  };
  deliveryLogPreview?: {
    enabled: true;
    draftOnly: true;
    totals: {
      all: number;
      candidate: number;
      blocked: number;
      sent: number;
      failed: number;
      skipped: number;
    };
    byKind: Array<{ kind: string; count: number }>;
    byChannel: Array<{ channel: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    recent: Array<{
      kind: string;
      sourceType: string;
      sourceRef: string;
      channel: string;
      status: string;
      provider: string;
      providerStatus: string | null;
      providerMessageRef: string | null;
      attemptCount: number;
      lastAttemptAt: string | null;
      nextAttemptAt: string | null;
      lastErrorCode: string | null;
      lastErrorMessageRedacted: string | null;
      skippedReason: string | null;
      sentAt: string | null;
      deliveredAt: string | null;
      failedAt: string | null;
      deliveryAllowed: boolean;
      draftOnly: boolean;
      blockedReasons: string[];
      frequencyWindowHours: number;
      createdAt: string;
    }>;
    privacyNote: string;
  };
  warning: string;
};

export function NotificationOpsPage({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [data, setData] = useState<AdminNotificationOpsPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          setErrorMessage("Bildirim operasyon durumu yüklenemedi.");
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

  if (isLoading) {
    return <div className="dashboard-page"><div className="state-panel">Bildirim operasyon durumu yükleniyor...</div></div>;
  }

  if (errorMessage) {
    return (
      <div className="dashboard-page">
        <div className="state-panel danger">{errorMessage}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const deliveryLogPreview = data.deliveryLogPreview;

  return (
    <div className="dashboard-page">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="eyebrow">Bildirim Operasyonları</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Bildirim gönderim sağlığı</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {data.warning} Delivery log önizlemesi aggregate ve redacted çalışır; gerçek provider gönderimleri ayrı processor ve env gate’leri üzerinden yürütülür.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <PolicyPill label="Durum" value={data.summary.draftOnly ? "Taslak mod" : data.summary.status} />
          <PolicyPill label="Gönderim" value={data.deliveryPolicy.sendEnabled ? "Açık" : "Kapalı"} />
          <PolicyPill label="Dedup" value={data.deliveryPolicy.dedupRequired ? "Gerekli" : "Kapalı"} />
          <PolicyPill
            label="Frekans limiti"
            value={data.deliveryPolicy.frequencyLimitRequired ? "Gerekli" : "Kapalı"}
          />
          {data.preferenceSummary ? (
            <>
              <PolicyPill label="Preference kaynağı" value={String(data.preferenceSummary.supportedSources.length)} />
              <PolicyPill label="Taslak kanallar" value={data.preferenceSummary.draftOnlyChannels.join(", ")} />
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="eyebrow">Delivery geçişleri</p>
        <h2 className="text-2xl font-black text-slate-950">Geçiş modeli</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Manuel ops geçişleri candidate/block/skip gibi güvenli durumlarla sınırlıdır; sent/failed durumları gerçek provider processor sonucunda oluşur.
          Örnek güvenli geçiş: candidate → skipped.
        </p>
        <p className="mt-1 text-xs text-slate-500">{data.transitionPreview.privacyNote}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">İzinli taslak geçişleri</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {data.transitionPreview.allowedDraftOnlyTransitions.map((transition) => (
                <div key={`${transition.from}-${transition.to}`}>
                  {transition.from} → {transition.to}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Gelecek provider geçişleri</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {data.transitionPreview.futureSenderTransitions.map((transition) => (
                <div key={`${transition.from}-${transition.to}`}>
                  <strong className="text-slate-950">{transition.from} → {transition.to}</strong>
                  <p className="mt-1">Şunlar tamamlanana kadar kapalı: {transition.blockedUntil.join(", ")}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="eyebrow">Mobil bildirimler</p>
        <h2 className="text-2xl font-black text-slate-950">Native push hazırlığı</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Push sender kapalı ise Expo/Firebase/APNs çağrısı yok. Push sender durumu env, token registry ve provider readiness değerlerine bağlıdır; gerçek Expo gönderimleri notification processor üzerinden yapılır.
        </p>
        <p className="mt-1 text-xs text-slate-500">{data.pushReadinessPreview.warning}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Push sender" value={data.pushReadinessPreview.pushSenderEnabled ? 1 : 0} />
          <SummaryCard label="Provider" value={data.pushReadinessPreview.providerConfigured ? 1 : 0} />
          <SummaryCard label="Token kayıtları" value={data.pushReadinessPreview.tokenRegistryEnabled ? 1 : 0} />
          <SummaryCard label="Token toplama" value={data.pushReadinessPreview.tokenCollectionAllowed ? 1 : 0} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Push sender öncesi gerekenler</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {data.pushReadinessPreview.requirements.map((requirement) => (
                <div className="flex justify-between gap-3" key={requirement.key}>
                  <span>{requirement.label}</span>
                  <strong className="text-slate-950">{requirement.status}</strong>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Rollout aşamaları</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {data.pushReadinessPreview.rolloutStages.map((stage) => (
                <div key={stage.stage}>
                  <strong className="text-slate-950">{stage.stage}: {stage.status}</strong>
                  <p className="mt-1">{stage.note}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="eyebrow">Otomasyon hazırlığı</p>
        <h2 className="text-2xl font-black text-slate-950">n8n workflow hazırlığı</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          n8n webhook ve worker durumu readiness değerlerine bağlıdır; gerçek tetikleme yalnızca provider env gate’leri açıkken processor üzerinden yapılır.
        </p>
        <p className="mt-1 text-xs text-slate-500">{data.n8nReadinessPreview.warning}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="n8n workflow" value={data.n8nReadinessPreview.n8nWorkflowEnabled ? 1 : 0} />
          <SummaryCard label="Webhook" value={data.n8nReadinessPreview.webhookCallsAllowed ? 1 : 0} />
          <SummaryCard label="Queue" value={data.n8nReadinessPreview.queueEnabled ? 1 : 0} />
          <SummaryCard label="Retry" value={data.n8nReadinessPreview.retryEnabled ? 1 : 0} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Workflow adayları</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {data.n8nReadinessPreview.workflowCandidates.map((candidate) => (
                <div key={candidate.key}>
                  <strong className="text-slate-950">{candidate.label}</strong>
                  <p className="mt-1">{candidate.note}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Webhook öncesi gerekenler</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {data.n8nReadinessPreview.requirements.map((requirement) => (
                <div className="flex justify-between gap-3" key={requirement.key}>
                  <span>{requirement.label}</span>
                  <strong className="text-slate-950">{requirement.status}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {deliveryLogPreview ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Delivery log</p>
              <h2 className="text-2xl font-black text-slate-950">Delivery log önizlemesi</h2>
              <p className="mt-2 text-sm text-slate-600">{deliveryLogPreview.privacyNote}</p>
              <p className="mt-1 text-xs text-slate-500">{DELIVERY_LOG_PRIVACY_BOUNDARY_NOTE}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
              Taslak mod
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <SummaryCard label="Toplam" value={deliveryLogPreview.totals.all} />
            <SummaryCard label="Candidate" value={deliveryLogPreview.totals.candidate} />
            <SummaryCard label="Blocked" value={deliveryLogPreview.totals.blocked} />
            <SummaryCard label="Sent" value={deliveryLogPreview.totals.sent} />
            <SummaryCard label="Failed" value={deliveryLogPreview.totals.failed} />
            <SummaryCard label="Skipped" value={deliveryLogPreview.totals.skipped} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Breakdown title="Türe göre" items={deliveryLogPreview.byKind} labelKey="kind" />
            <Breakdown title="Kanala göre" items={deliveryLogPreview.byChannel} labelKey="channel" />
            <Breakdown title="Duruma göre" items={deliveryLogPreview.byStatus} labelKey="status" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tür</th>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Kanal</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Deneme</th>
                  <th className="px-4 py-3">Son hata</th>
                  <th className="px-4 py-3">Oluşturma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryLogPreview.recent.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={8}>
                      Henüz delivery log candidate yok.
                    </td>
                  </tr>
                ) : (
                  deliveryLogPreview.recent.map((item) => (
                    <tr key={`${item.kind}-${item.sourceRef}-${item.createdAt}`}>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.kind}</td>
                      <td className="px-4 py-3 text-slate-600">{item.sourceType}:{item.sourceRef}</td>
                      <td className="px-4 py-3 text-slate-600">{item.channel}</td>
                      <td className="px-4 py-3 text-slate-600">{item.status}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.provider}
                        {item.providerStatus ? ` / ${item.providerStatus}` : ""}
                        {item.providerMessageRef ? ` / ${item.providerMessageRef}` : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.attemptCount}
                        {item.nextAttemptAt ? ` / retry ${item.nextAttemptAt}` : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.lastErrorCode ?? item.skippedReason ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {data.channels.map((channel) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={channel.key}>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-base font-black text-slate-950">{channel.label}</strong>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {channel.status === "draft_only" ? "Taslak mod" : "Planlı"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{channel.note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Gerçek delivery öncesi yapılacaklar</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {data.nextSteps.map((step) => (
            <li key={step}>• {step}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PolicyPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
      {label}: {value}
    </span>
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

function Breakdown({
  title,
  items,
  labelKey
}: {
  title: string;
  items: Array<Record<string, string | number>>;
  labelKey: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıt yok.</p>
        ) : (
          items.map((item) => (
            <div className="flex justify-between gap-3 text-sm" key={`${String(item[labelKey])}-${String(item.count)}`}>
              <span className="text-slate-600">{String(item[labelKey])}</span>
              <strong className="text-slate-950">{String(item.count)}</strong>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
