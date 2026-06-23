"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  fetchChildProfiles,
  fetchLifecycleRecommendations,
  type ChildAgeBand,
  type ChildProfile,
  type ChildProfileNotificationCadence,
  type LifecycleRecommendationGroup
} from "../child-profiles/api";
import {
  fetchSavedSearches,
  type SavedSearch
} from "../saved-searches/api";
import {
  fetchNotificationDeliveryDrafts,
  type NotificationDeliveryDraft,
  type NotificationDeliveryDraftsPayload
} from "./api";

type NotificationPreferencesPageContentProps = {
  apiBaseUrl: string;
};

type NotificationDraft = {
  id: string;
  title: string;
  body: string;
  cadenceLabel: string;
  statusLabel: string;
  actionHref: string;
  actionLabel: string;
};

export function NotificationPreferencesPageContent({ apiBaseUrl }: NotificationPreferencesPageContentProps) {
  const { dictionary } = useI18n();
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [lifecycleGroups, setLifecycleGroups] = useState<LifecycleRecommendationGroup[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [deliveryDraftsPayload, setDeliveryDraftsPayload] = useState<NotificationDeliveryDraftsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    if (!(await requireAuth())) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [childProfilesResponse, lifecycleResponse, savedSearchesResponse, deliveryDraftsResponse] = await Promise.all([
        fetchChildProfiles(apiBaseUrl),
        fetchLifecycleRecommendations(apiBaseUrl),
        fetchSavedSearches(apiBaseUrl),
        fetchNotificationDeliveryDrafts(apiBaseUrl)
      ]);

      if (!childProfilesResponse.ok) {
        setErrorMessage(getApiErrorMessage(childProfilesResponse.error as ApiError, dictionary));
        setChildProfiles([]);
        setLifecycleGroups([]);
        setSavedSearches([]);
      setDeliveryDraftsPayload(null);
        setDeliveryDraftsPayload(null);
        return;
      }

      if (!savedSearchesResponse.ok) {
        setErrorMessage(getApiErrorMessage(savedSearchesResponse.error as ApiError, dictionary));
        setChildProfiles([]);
        setLifecycleGroups([]);
        setSavedSearches([]);
        setDeliveryDraftsPayload(null);
        return;
      }

      setChildProfiles(childProfilesResponse.data.childProfiles);
      setLifecycleGroups(lifecycleResponse.ok ? lifecycleResponse.data.groups : []);
      setSavedSearches(savedSearchesResponse.data.savedSearches);
      setDeliveryDraftsPayload(deliveryDraftsResponse.ok ? deliveryDraftsResponse.data : null);
    } catch {
      setErrorMessage(dictionary.common.apiUnavailable);
      setChildProfiles([]);
      setLifecycleGroups([]);
      setSavedSearches([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, dictionary, requireAuth]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void loadPreferences();
  }, [isCheckingAuth, loadPreferences]);

  const childDrafts = useMemo(
    () => buildChildLifecycleNotificationDrafts(childProfiles, lifecycleGroups),
    [childProfiles, lifecycleGroups]
  );
  const savedSearchMetrics = useMemo(() => buildSavedSearchMetrics(savedSearches), [savedSearches]);
  const childMetrics = useMemo(() => buildChildNotificationMetrics(childProfiles), [childProfiles]);

  return (
    <PageContainer className="pb-14 pt-5" ariaLabel="Bildirim tercihleri">
      <section className="mb-5 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_18px_60px_rgba(55,48,42,0.08)] sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
          Notification preferences
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Bildirim tercihleri
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground sm:text-base">
          Çocuk profili, kayıtlı arama ve marketplace bildirimlerini tek yerde gör. Bu sayfa şimdilik güvenli önizleme
          ve yönlendirme sağlar; kullanıcı onayı olmadan bildirim göndermez.
        </p>
      </section>

      {errorMessage ? <Alert title="Bildirim tercihleri alınamadı" message={errorMessage} /> : null}

      {isLoading || isCheckingAuth ? (
        <LoadingBlock
          title="Bildirim tercihleri yükleniyor"
          message="Çocuk profili ve kayıtlı arama tercihleri hazırlanıyor."
        />
      ) : null}

      {!isLoading && !isCheckingAuth && !errorMessage ? (
        <div className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Çocuk profili bildirimi"
              value={`${childMetrics.enabled}/${childMetrics.total}`}
              description="Aylık/yıllık bildirim tercihi açık olan aktif çocuk profilleri."
            />
            <MetricCard
              label="Kayıtlı arama bildirimi"
              value={`${savedSearchMetrics.enabled}/${savedSearchMetrics.total}`}
              description="Yeni ilan eşleşmeleri için bildirim tercihi açık aramalar."
            />
            <MetricCard
              label="Hazır bildirim taslağı"
              value={`${deliveryDraftsPayload?.summary.total ?? childDrafts.length}`}
              description="Delivery endpoint tarafından üretilen no-write taslak sayısı."
            />
          </section>

          <ChildLifecycleNotificationSection
            childDrafts={childDrafts}
            childProfiles={childProfiles}
          />

          <DeliveryDraftSection payload={deliveryDraftsPayload} />

          <SavedSearchNotificationSection
            metrics={savedSearchMetrics}
            savedSearches={savedSearches}
          />

          <NotificationDeliveryRoadmap />
        </div>
      ) : null}
    </PageContainer>
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
    <article className="rounded-[1.25rem] border border-border/70 bg-background p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <strong className="mt-2 block text-3xl font-black text-foreground">{value}</strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

function ChildLifecycleNotificationSection({
  childDrafts,
  childProfiles
}: {
  childDrafts: NotificationDraft[];
  childProfiles: ChildProfile[];
}) {
  if (childProfiles.length === 0) {
    return (
      <EmptyState
        title="Çocuk profili yok"
        message="Yaşa göre öneri ve bildirim taslağı için önce çocuk profili ekleyebilirsin."
        actionHref="/account/children"
        actionLabel="Çocuğum sayfasına git"
      />
    );
  }

  return (
    <section className="grid gap-4 rounded-[1.5rem] border border-border/70 bg-background p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Child lifecycle notifications
          </p>
          <h2 className="mt-1 text-xl font-black text-foreground">Çocuk profili bildirim taslakları</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Aylık/yıllık tercih açık olduğunda hangi tür öneri bildiriminin hazırlanabileceğini gösterir.
            Gönderim altyapısı sonraki pakette bağlanacak.
          </p>
        </div>
        <Link
          className="inline-flex w-fit rounded-full border border-border bg-background px-4 py-2 text-sm font-black text-foreground"
          href="/account/children"
        >
          Çocuk profillerini düzenle
        </Link>
      </div>

      {childDrafts.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border bg-muted/20 p-4">
          <strong className="text-base font-black text-foreground">Aktif taslak yok</strong>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Aktif çocuk profillerinde bildirim sıklığı kapalıysa taslak üretmeyiz. İstersen Çocuğum sayfasında aylık/yıllık tercihi açabilirsin.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {childDrafts.map((draft) => (
            <NotificationDraftCard draft={draft} key={draft.id} />
          ))}
        </div>
      )}

      <ChildCadenceList childProfiles={childProfiles} />
    </section>
  );
}

function NotificationDraftCard({ draft }: { draft: NotificationDraft }) {
  return (
    <article className="grid gap-3 rounded-[1.25rem] border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/15">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-black text-foreground">{draft.title}</strong>
          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-black text-muted-foreground">
            {draft.cadenceLabel}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{draft.body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black text-muted-foreground">
          {draft.statusLabel}
        </span>
        <Link
          className="rounded-full bg-foreground px-4 py-2 text-sm font-black text-background"
          href={draft.actionHref}
        >
          {draft.actionLabel}
        </Link>
      </div>
    </article>
  );
}

function ChildCadenceList({ childProfiles }: { childProfiles: ChildProfile[] }) {
  return (
    <div className="grid gap-2 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
      <p className="text-sm font-black text-foreground">Çocuk profili bildirim sıklığı</p>
      <div className="grid gap-2">
        {childProfiles.map((childProfile) => (
          <div
            className="flex flex-col gap-1 rounded-2xl bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            key={childProfile.id}
          >
            <div>
              <strong className="text-sm font-black text-foreground">{formatChildLabel(childProfile.label)}</strong>
              <p className="text-xs font-bold text-muted-foreground">
                {formatAgeBand(childProfile.ageBand)} · {childProfile.isActive ? "Aktif" : "Pasif"}
              </p>
            </div>
            <span className="w-fit rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-black text-muted-foreground">
              {formatCadence(childProfile.notificationCadence)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


function DeliveryDraftSection({ payload }: { payload: NotificationDeliveryDraftsPayload | null }) {
  const drafts = payload?.drafts ?? [];

  return (
    <section className="grid gap-4 rounded-[1.5rem] border border-border/70 bg-background p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
          Delivery drafts
        </p>
        <h2 className="mt-1 text-xl font-black text-foreground">Bildirim gönderim taslakları</h2>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Bu kartlar email, push veya in-app bildirim göndermez. Sadece sonraki delivery paketinde işlenecek adayları gösterir.
        </p>
      </div>

      {payload ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Toplam taslak"
            value={`${payload.summary.total}`}
            description="No-write delivery draft sayısı."
          />
          <MetricCard
            label="Çocuk lifecycle"
            value={`${payload.summary.childLifecycle}`}
            description="Çocuk profili yaş döneminden gelen adaylar."
          />
          <MetricCard
            label="Kayıtlı arama"
            value={`${payload.summary.savedSearch}`}
            description="Bildirim açık kayıtlı arama adayları."
          />
        </div>
      ) : null}

      {drafts.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-border bg-muted/20 p-4">
          <strong className="text-base font-black text-foreground">Gönderim taslağı yok</strong>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
            Bildirim açık çocuk profili veya kayıtlı arama olduğunda taslaklar burada görünür.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {drafts.slice(0, 8).map((draft) => (
            <DeliveryDraftCard draft={draft} key={draft.id} />
          ))}
        </div>
      )}

      {payload?.note ? (
        <p className="rounded-2xl border border-border bg-muted/20 p-3 text-xs font-bold leading-5 text-muted-foreground">
          {payload.note}
        </p>
      ) : null}
    </section>
  );
}

function DeliveryDraftCard({ draft }: { draft: NotificationDeliveryDraft }) {
  return (
    <article className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-black text-foreground">{draft.title}</strong>
          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-black text-muted-foreground">
            {formatDraftKind(draft.kind)}
          </span>
          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-black text-muted-foreground">
            {formatDraftChannel(draft.channel)}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{draft.body}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-muted-foreground">{draft.reason}</p>
        <p className="mt-2 rounded-2xl border border-border bg-background/80 p-2 text-xs font-bold leading-5 text-muted-foreground">
          Draft-only · dedup key hazır · frekans penceresi: {draft.policy.frequencyWindowHours} saat · gönderim kapalı
        </p>
      </div>
      <Link
        className="w-fit rounded-full bg-foreground px-4 py-2 text-sm font-black text-background"
        href={draft.action.href}
      >
        {draft.action.label}
      </Link>
    </article>
  );
}


function SavedSearchNotificationSection({
  metrics,
  savedSearches
}: {
  metrics: ReturnType<typeof buildSavedSearchMetrics>;
  savedSearches: SavedSearch[];
}) {
  return (
    <section className="grid gap-4 rounded-[1.5rem] border border-border/70 bg-background p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Saved search notifications
          </p>
          <h2 className="mt-1 text-xl font-black text-foreground">Kayıtlı arama bildirimleri</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Yeni ilan eşleşmeleri için hangi kayıtlı aramaların bildirim üretmeye aday olduğunu gör.
          </p>
        </div>
        <Link
          className="inline-flex w-fit rounded-full border border-border bg-background px-4 py-2 text-sm font-black text-foreground"
          href="/account/saved-searches"
        >
          Kayıtlı aramaları yönet
        </Link>
      </div>

      {savedSearches.length === 0 ? (
        <EmptyState
          title="Kayıtlı arama yok"
          message="Browse sayfasında arama kaydederek bildirim adaylarını oluşturabilirsin."
          actionHref="/browse"
          actionLabel="İlanları keşfet"
        />
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Toplam"
              value={`${metrics.total}`}
              description="Kayıtlı arama sayısı."
            />
            <MetricCard
              label="Bildirim açık"
              value={`${metrics.enabled}`}
              description="Eşleşme bildirimi üretmeye aday."
            />
            <MetricCard
              label="Bildirim kapalı"
              value={`${metrics.disabled}`}
              description="Sadece manuel takip için tutuluyor."
            />
          </div>

          <div className="grid gap-2">
            {savedSearches.slice(0, 8).map((savedSearch) => (
              <SavedSearchNotificationRow savedSearch={savedSearch} key={savedSearch.id} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SavedSearchNotificationRow({ savedSearch }: { savedSearch: SavedSearch }) {
  return (
    <article className="flex flex-col gap-2 rounded-[1.1rem] border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <strong className="text-sm font-black text-foreground">{savedSearch.name}</strong>
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          {savedSearch.q || "Tüm ilanlar"} · {savedSearch.sort || "newest"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="w-fit rounded-full border border-border bg-background px-3 py-1 text-xs font-black text-muted-foreground">
          {savedSearch.notificationsEnabled ? "Bildirim açık" : "Bildirim kapalı"}
        </span>
        <Link
          className="rounded-full bg-foreground px-3 py-1.5 text-xs font-black text-background"
          href={buildSavedSearchHref(savedSearch)}
        >
          Aramayı aç
        </Link>
      </div>
    </article>
  );
}

function NotificationDeliveryRoadmap() {
  return (
    <section className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-muted/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
        Delivery roadmap
      </p>
      <h2 className="text-xl font-black text-foreground">Gönderim altyapısı sonraki paket</h2>
      <p className="max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
        Bu ekranda tercih ve taslakları görünür yaptık. Sonraki adımda eşleşme hesaplama, deduplication,
        delivery log, email provider ve n8n hook kontrollü şekilde bağlanacak.
      </p>
      <ul className="grid gap-2 text-sm font-semibold leading-6 text-muted-foreground sm:grid-cols-2">
        <li>• Kayıtlı arama eşleşme kontrolü</li>
        <li>• Çocuk yaş/mevsim digest üretimi</li>
        <li>• Kullanıcı frekans limiti ve sessize alma</li>
        <li>• Backoffice delivery log ve audit</li>
      </ul>
    </section>
  );
}

function buildChildLifecycleNotificationDrafts(
  childProfiles: ChildProfile[],
  lifecycleGroups: LifecycleRecommendationGroup[]
): NotificationDraft[] {
  const groupsByChildProfileId = new Map(lifecycleGroups.map((group) => [group.childProfileId, group]));

  return childProfiles
    .filter((childProfile) => childProfile.isActive && childProfile.notificationCadence !== "off")
    .flatMap((childProfile) => {
      const group = groupsByChildProfileId.get(childProfile.id);
      const recommendations = group?.recommendations ?? [];

      if (recommendations.length === 0) {
        return [];
      }

      return recommendations.slice(0, 2).map((recommendation) => ({
        id: `${childProfile.id}-${recommendation.categoryId}-${recommendation.reasonCode}`,
        title: `${formatChildLabel(childProfile.label)} için ${recommendation.categoryName}`,
        body: `${formatAgeBand(childProfile.ageBand)} döneminde takip edilebilir. ${recommendation.whyNow}`,
        cadenceLabel: formatCadence(childProfile.notificationCadence),
        statusLabel: "Taslak · gönderim yok",
        actionHref: buildRecommendationBrowseHref(recommendation),
        actionLabel: "İlanlara bak"
      }));
    });
}

function buildChildNotificationMetrics(childProfiles: ChildProfile[]) {
  const active = childProfiles.filter((childProfile) => childProfile.isActive);
  const enabled = active.filter((childProfile) => childProfile.notificationCadence !== "off");

  return {
    total: active.length,
    enabled: enabled.length
  };
}

function buildSavedSearchMetrics(savedSearches: SavedSearch[]) {
  const enabled = savedSearches.filter((savedSearch) => savedSearch.notificationsEnabled);

  return {
    total: savedSearches.length,
    enabled: enabled.length,
    disabled: savedSearches.length - enabled.length
  };
}

function buildRecommendationBrowseHref(
  recommendation: LifecycleRecommendationGroup["recommendations"][number]
): string {
  const params = new URLSearchParams({
    categoryId: recommendation.categoryId,
    sort: "newest"
  });

  return `/browse?${params.toString()}`;
}

function buildSavedSearchHref(savedSearch: SavedSearch): string {
  const params = new URLSearchParams();

  appendParam(params, "q", savedSearch.q);
  appendParam(params, "categoryId", savedSearch.categoryId ?? "");
  appendParam(params, "listingType", savedSearch.listingType ?? "");
  appendParam(params, "condition", savedSearch.condition ?? "");
  appendParam(params, "priceMin", savedSearch.priceMin ?? "");
  appendParam(params, "priceMax", savedSearch.priceMax ?? "");
  appendParam(params, "hasImages", savedSearch.hasImages ? "true" : "");
  appendParam(params, "sort", savedSearch.sort);

  const query = params.toString();

  return query ? `/browse?${query}` : "/browse";
}

function appendParam(params: URLSearchParams, key: string, value: string) {
  if (value.trim().length > 0) {
    params.set(key, value);
  }
}

function formatCadence(cadence: ChildProfileNotificationCadence): string {
  const labels: Record<ChildProfileNotificationCadence, string> = {
    off: "Kapalı",
    monthly: "Aylık",
    yearly: "Yıllık"
  };

  return labels[cadence];
}

function formatAgeBand(ageBand: ChildAgeBand): string {
  const labels: Record<ChildAgeBand, string> = {
    expecting: "Doğum öncesi",
    newborn_0_3: "0-3 ay",
    infant_3_6: "3-6 ay",
    infant_6_12: "6-12 ay",
    toddler_12_24: "12-24 ay",
    preschool_24_36: "24-36 ay",
    child_3_plus: "3 yaş ve üzeri"
  };

  return labels[ageBand];
}

function formatChildLabel(label: string): string {
  const normalized = label.replace(/\s+/gu, " ").trim();

  return normalized.length > 0 ? normalized.slice(0, 40) : "Çocuğum";
}

function formatDraftKind(kind: NotificationDeliveryDraft["kind"]): string {
  const labels: Record<NotificationDeliveryDraft["kind"], string> = {
    child_lifecycle: "Çocuk önerisi",
    saved_search: "Kayıtlı arama"
  };

  return labels[kind];
}

function formatDraftChannel(channel: NotificationDeliveryDraft["channel"]): string {
  const labels: Record<NotificationDeliveryDraft["channel"], string> = {
    in_app: "In-app taslak",
    email_draft: "Email taslak"
  };

  return labels[channel];
}
