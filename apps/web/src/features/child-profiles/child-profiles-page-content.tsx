"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  EmptyState,
  LoadingBlock,
  PageContainer,
  Select,
  TextInput
} from "../../components/ui";
import { useProtectedRoute } from "../../lib/use-protected-route";
import {
  createChildProfile,
  deleteChildProfile,
  fetchChildProfiles,
  fetchLifecycleRecommendations,
  updateChildProfile,
  type ChildAgeBand,
  type ChildProfile,
  type ChildProfileGender,
  type ChildProfileNotificationCadence,
  type LifecycleRecommendationGroup
} from "./api";

type ChildProfilesPageContentProps = {
  apiBaseUrl: string;
};

type EditorMode = "view" | "new" | "edit";
type AgeInputMode = "months" | "birth";

type ChildProfileFormState = {
  ageInputMode: AgeInputMode;
  ageMonths: string;
  birthMonth: string;
  birthYear: string;
  gender: ChildProfileGender;
  label: string;
  notificationCadence: ChildProfileNotificationCadence;
};

const DEFAULT_FORM_STATE: ChildProfileFormState = {
  ageInputMode: "months",
  ageMonths: "",
  birthMonth: String(new Date().getMonth() + 1),
  birthYear: String(new Date().getFullYear()),
  gender: "prefer_not_to_say",
  label: "",
  notificationCadence: "off"
};

const MONTH_OPTIONS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık"
];

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, index) => String(new Date().getFullYear() - index));

export function ChildProfilesPageContent({ apiBaseUrl }: ChildProfilesPageContentProps) {
  const { isCheckingAuth, requireAuth } = useProtectedRoute({ apiBaseUrl });
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [recommendationGroups, setRecommendationGroups] = useState<LifecycleRecommendationGroup[]>([]);
  const [selectedChildProfileId, setSelectedChildProfileId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("new");
  const [formState, setFormState] = useState<ChildProfileFormState>(DEFAULT_FORM_STATE);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedChildProfile = useMemo(
    () => childProfiles.find((childProfile) => childProfile.id === selectedChildProfileId) ?? null,
    [childProfiles, selectedChildProfileId]
  );

  const selectedRecommendationGroup = useMemo(
    () =>
      selectedChildProfile
        ? recommendationGroups.find((group) => group.childProfileId === selectedChildProfile.id) ?? null
        : null,
    [recommendationGroups, selectedChildProfile]
  );

  const loadChildProfiles = useCallback(async () => {
    if (!(await requireAuth())) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const [childProfilesResponse, lifecycleRecommendationsResponse] = await Promise.all([
        fetchChildProfiles(apiBaseUrl),
        fetchLifecycleRecommendations(apiBaseUrl)
      ]);

      if (!childProfilesResponse.ok) {
        setMessage({ tone: "error", text: "Çocuk bilgileri şu anda yüklenemiyor." });
        return;
      }

      const nextChildProfiles = childProfilesResponse.data.childProfiles;
      setChildProfiles(nextChildProfiles);
      setRecommendationGroups(lifecycleRecommendationsResponse.ok ? lifecycleRecommendationsResponse.data.groups : []);
      setSelectedChildProfileId((currentId) => {
        if (currentId && nextChildProfiles.some((childProfile) => childProfile.id === currentId)) {
          return currentId;
        }

        return nextChildProfiles[0]?.id ?? null;
      });
      setEditorMode(nextChildProfiles.length > 0 ? "view" : "new");
    } catch {
      setRecommendationGroups([]);
      setMessage({ tone: "error", text: "Çocuk bilgileri şu anda yüklenemiyor." });
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, requireAuth]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void loadChildProfiles();
  }, [isCheckingAuth, loadChildProfiles]);

  function startNewProfile() {
    setEditorMode("new");
    setSelectedChildProfileId(null);
    setFormState(DEFAULT_FORM_STATE);
    setMessage(null);
  }

  function startEditProfile(childProfile: ChildProfile) {
    setSelectedChildProfileId(childProfile.id);
    setEditorMode("edit");
    setFormState(buildFormStateFromProfile(childProfile));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isAuthenticated = await requireAuth();

    if (!isAuthenticated) {
      return;
    }

    const payload = buildChildProfilePayload(formState);

    if (!payload) {
      setMessage({ tone: "error", text: "Yaş bilgisi eksik veya geçersiz." });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response =
      editorMode === "edit" && selectedChildProfile
        ? await updateChildProfile(apiBaseUrl, selectedChildProfile.id, payload)
        : await createChildProfile(apiBaseUrl, {
            ...payload,
            isActive: true
          });

    if (!response.ok) {
      setMessage({ tone: "error", text: "Çocuk bilgisi kaydedilemedi." });
      setIsSubmitting(false);
      return;
    }

    await loadChildProfiles();
    setSelectedChildProfileId(response.data.childProfile.id);
    setEditorMode("view");
    setMessage({ tone: "info", text: "Kaydedildi." });
    setIsSubmitting(false);
  }

  async function handleToggleActive(childProfile: ChildProfile) {
    const response = await updateChildProfile(apiBaseUrl, childProfile.id, {
      isActive: !childProfile.isActive
    });

    if (!response.ok) {
      setMessage({ tone: "error", text: "İşlem tamamlanamadı." });
      return;
    }

    await loadChildProfiles();
  }

  async function handleDelete(childProfile: ChildProfile) {
    const response = await deleteChildProfile(apiBaseUrl, childProfile.id);

    if (!response.ok) {
      setMessage({ tone: "error", text: "Silme işlemi tamamlanamadı." });
      return;
    }

    await loadChildProfiles();
    setMessage({ tone: "info", text: "Çocuk bilgisi silindi." });
  }

  return (
    <PageContainer className="max-w-6xl py-8 sm:py-10" ariaLabel="Çocuğum">
      <header className="mb-5 space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Çocuğum</h1>
        <p className="max-w-xl text-sm font-semibold leading-6 text-muted-foreground">
          Çocuğuna ait temel bilgileri sade şekilde tut.
        </p>
      </header>

      {message ? (
        <div className="mb-4">
          <Alert
            title={message.tone === "error" ? "İşlem tamamlanamadı" : "İşlem tamamlandı"}
            message={message.text}
            tone={message.tone}
          />
        </div>
      ) : null}

      <section className="grid gap-4 rounded-[1.75rem] border border-border bg-background/88 p-4 shadow-sm backdrop-blur md:grid-cols-[minmax(220px,300px)_1fr] sm:p-5">
        <aside className="space-y-4 rounded-[1.35rem] border border-border bg-muted/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-foreground">Çocuklar</h2>
            <Button type="button" variant="secondary" onClick={startNewProfile}>
              Yeni çocuk ekle
            </Button>
          </div>

          {isLoading || isCheckingAuth ? (
            <LoadingBlock title="Yükleniyor" message="Çocuk bilgileri hazırlanıyor." />
          ) : null}

          {!isLoading && childProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background p-4">
              <p className="font-black text-foreground">Henüz çocuk eklenmedi</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Başlamak için yeni çocuk ekle.
              </p>
            </div>
          ) : null}

          {childProfiles.length > 0 ? (
            <div className="space-y-2">
              {childProfiles.map((childProfile) => (
                <button
                  className={[
                    "w-full rounded-2xl border p-3 text-left transition hover:border-rose-200 hover:bg-background",
                    selectedChildProfileId === childProfile.id && editorMode !== "new"
                      ? "border-rose-300 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/20"
                      : "border-border bg-background/75"
                  ].join(" ")}
                  key={childProfile.id}
                  type="button"
                  onClick={() => {
                    setSelectedChildProfileId(childProfile.id);
                    setEditorMode("view");
                    setMessage(null);
                  }}
                >
                  <span className="block truncate text-sm font-black text-foreground">
                    {formatChildLabel(childProfile.label)}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                    {formatAgeSummary(childProfile)}
                  </span>
                  {!childProfile.isActive ? (
                    <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-[0.68rem] font-black text-muted-foreground">
                      Pasif
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 rounded-[1.35rem] border border-border bg-background p-4 sm:p-5">
          {editorMode === "new" || editorMode === "edit" ? (
            <ChildProfileForm
              formState={formState}
              isSubmitting={isSubmitting}
              mode={editorMode}
              onCancel={() => {
                setEditorMode(selectedChildProfile ? "view" : "new");
                setFormState(selectedChildProfile ? buildFormStateFromProfile(selectedChildProfile) : DEFAULT_FORM_STATE);
                setMessage(null);
              }}
              onChange={setFormState}
              onSubmit={handleSubmit}
            />
          ) : selectedChildProfile ? (
            <ChildProfileSummary
              childProfile={selectedChildProfile}
              recommendationGroup={selectedRecommendationGroup}
              onDelete={() => void handleDelete(selectedChildProfile)}
              onEdit={() => startEditProfile(selectedChildProfile)}
              onToggleActive={() => void handleToggleActive(selectedChildProfile)}
            />
          ) : (
            <EmptyState
              title="Henüz çocuk eklenmedi"
              message="Başlamak için yeni çocuk ekle."
            />
          )}
        </main>
      </section>
    </PageContainer>
  );
}

function ChildProfileForm({
  formState,
  isSubmitting,
  mode,
  onCancel,
  onChange,
  onSubmit
}: {
  formState: ChildProfileFormState;
  isSubmitting: boolean;
  mode: "new" | "edit";
  onCancel: () => void;
  onChange: (nextState: ChildProfileFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          {mode === "edit" ? "Düzenle" : "Yeni çocuk ekle"}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">Temel bilgiler</h2>
      </div>

      <TextInput
        label="İsim veya etiket"
        maxLength={80}
        onChange={(event) => onChange({ ...formState, label: event.target.value })}
        placeholder="Çocuğum"
        value={formState.label}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-black text-foreground">Yaş bilgisi</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className={buildModeButtonClass(formState.ageInputMode === "months")}
            type="button"
            onClick={() => onChange({ ...formState, ageInputMode: "months" })}
          >
            Yaşını ay olarak biliyorum
          </button>
          <button
            className={buildModeButtonClass(formState.ageInputMode === "birth")}
            type="button"
            onClick={() => onChange({ ...formState, ageInputMode: "birth" })}
          >
            Doğum ayı ve yılı
          </button>
        </div>

        {formState.ageInputMode === "months" ? (
          <div className="max-w-xs">
            <TextInput
              label="Yaş"
              min={0}
              max={96}
              onChange={(event) => onChange({ ...formState, ageMonths: event.target.value })}
              placeholder="39"
              type="number"
              value={formState.ageMonths}
            />
            <p className="mt-1 text-xs font-semibold text-muted-foreground">ay</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Doğum ayı"
              onChange={(event) => onChange({ ...formState, birthMonth: event.target.value })}
              value={formState.birthMonth}
            >
              {MONTH_OPTIONS.map((month, index) => (
                <option key={month} value={String(index + 1)}>
                  {month}
                </option>
              ))}
            </Select>
            <Select
              label="Doğum yılı"
              onChange={(event) => onChange({ ...formState, birthYear: event.target.value })}
              value={formState.birthYear}
            >
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Cinsiyet"
          onChange={(event) => onChange({ ...formState, gender: event.target.value as ChildProfileGender })}
          value={formState.gender}
        >
          <option value="prefer_not_to_say">Belirtmek istemiyorum</option>
          <option value="female">Kız</option>
          <option value="male">Erkek</option>
        </Select>

        <Select
          label="Bildirim sıklığı"
          onChange={(event) =>
            onChange({
              ...formState,
              notificationCadence: event.target.value as ChildProfileNotificationCadence
            })
          }
          value={formState.notificationCadence}
        >
          <option value="off">Kapalı</option>
          <option value="monthly">Aylık</option>
          <option value="yearly">Yıllık</option>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Kaydediliyor" : "Kaydet"}
        </Button>
        <Button disabled={isSubmitting} type="button" variant="secondary" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

function ChildProfileSummary({
  childProfile,
  recommendationGroup,
  onDelete,
  onEdit,
  onToggleActive
}: {
  childProfile: ChildProfile;
  recommendationGroup: LifecycleRecommendationGroup | null;
  onDelete: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            Seçili çocuk
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-foreground">
            {formatChildLabel(childProfile.label)}
          </h2>
        </div>
        <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
          {childProfile.isActive ? "Aktif" : "Pasif"}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <SummaryItem label="Yaş bilgisi" value={formatAgeSummary(childProfile)} />
        <SummaryItem label="Cinsiyet" value={formatGender(childProfile.gender)} />
        <SummaryItem label="Bildirim sıklığı" value={formatNotificationCadence(childProfile.notificationCadence)} />
        <SummaryItem label="Kayıt durumu" value={childProfile.isActive ? "Aktif" : "Pasif"} />
      </dl>

      <ChildLifecycleRecommendations
        childProfile={childProfile}
        recommendationGroup={recommendationGroup}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onEdit}>
          Düzenle
        </Button>
        <Button type="button" variant="secondary" onClick={onToggleActive}>
          {childProfile.isActive ? "Pasifleştir" : "Aktifleştir"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDelete}>
          Sil
        </Button>
      </div>
    </div>
  );
}


function ChildLifecycleRecommendations({
  childProfile,
  recommendationGroup
}: {
  childProfile: ChildProfile;
  recommendationGroup: LifecycleRecommendationGroup | null;
}) {
  const recommendations = recommendationGroup?.recommendations ?? [];
  const ageBandLabel = recommendationGroup
    ? formatAgeBand(recommendationGroup.ageBand)
    : formatAgeBand(childProfile.ageBand);

  if (!childProfile.isActive) {
    return (
      <section className="rounded-[1.35rem] border border-dashed border-border bg-muted/20 p-4">
        <p className="text-sm font-black text-foreground">Öneriler pasif</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Bu çocuk profili pasif olduğu için yaşa göre ürün önerileri gösterilmiyor.
        </p>
      </section>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section className="rounded-[1.35rem] border border-dashed border-border bg-muted/20 p-4">
        <p className="text-sm font-black text-foreground">Henüz öneri yok</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Kategori verileri hazır olduğunda yaş dönemine göre takip edilebilecek ürünler burada görünür.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-[1.35rem] border border-rose-100 bg-rose-50/55 p-4 dark:border-rose-900/60 dark:bg-rose-950/15">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">
          Yaşa göre öneriler
        </p>
        <h3 className="mt-1 text-lg font-black text-foreground">
          {formatChildLabel(childProfile.label)} için takip edilebilecek ürünler
        </h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Bu alan alışveriş takibi içindir; otomatik bildirim veya kayıtlı arama oluşturmaz.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {recommendations.slice(0, 4).map((recommendation) => (
          <article
            className="rounded-2xl border border-border bg-background/88 p-4 shadow-sm"
            key={`${recommendation.categoryId}-${recommendation.reasonCode}`}
          >
            <div className="flex flex-col gap-1">
              <strong className="text-base font-black text-foreground">{recommendation.categoryName}</strong>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                {ageBandLabel}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
              {recommendation.whyNow}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className="rounded-full bg-foreground px-3 py-2 text-xs font-black text-background"
                href={buildRecommendationBrowseHref(recommendation)}
              >
                İlanlara bak
              </Link>
              <Link
                className="rounded-full border border-border bg-background px-3 py-2 text-xs font-black text-foreground"
                href={buildAssistantPromptHref(childProfile, recommendation)}
              >
                Asistana sor
              </Link>
            </div>
          </article>
        ))}
      </div>

      {childProfile.notificationCadence === "off" ? (
        <p className="rounded-2xl border border-border bg-background/80 p-3 text-xs font-bold leading-5 text-muted-foreground">
          Bildirimler kapalı. İstersen “Düzenle” ile aylık/yıllık hatırlatma tercihini açabilirsin.
        </p>
      ) : (
        <p className="rounded-2xl border border-border bg-background/80 p-3 text-xs font-bold leading-5 text-muted-foreground">
          Bildirim tercihi: {formatNotificationCadence(childProfile.notificationCadence)}. Gönderim altyapısı sonraki notification paketinde bağlanacak.
        </p>
      )}
    </section>
  );
}


function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-4">
      <dt className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base font-black text-foreground">{value}</dd>
    </div>
  );
}

function buildChildProfilePayload(formState: ChildProfileFormState): {
  ageBand: ChildAgeBand;
  ageMonths?: number | null;
  birthMonth?: number | null;
  birthYear?: number | null;
  gender: ChildProfileGender;
  label: string;
  notificationCadence: ChildProfileNotificationCadence;
} | null {
  const label = formState.label.trim() || "Çocuğum";
  const gender = formState.gender;

  if (formState.ageInputMode === "months") {
    const ageMonths = Number.parseInt(formState.ageMonths, 10);

    if (!Number.isInteger(ageMonths) || ageMonths < 0 || ageMonths > 96) {
      return null;
    }

    return {
      ageBand: deriveAgeBandFromMonths(ageMonths),
      ageMonths,
      birthMonth: null,
      birthYear: null,
      gender,
      label,
      notificationCadence: formState.notificationCadence
    };
  }

  const birthMonth = Number.parseInt(formState.birthMonth, 10);
  const birthYear = Number.parseInt(formState.birthYear, 10);

  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    return null;
  }

  if (!Number.isInteger(birthYear) || birthYear < 2016 || birthYear > 2035) {
    return null;
  }

  const ageMonths = calculateAgeMonthsFromBirthMonthYear(birthMonth, birthYear);

  return {
    ageBand: deriveAgeBandFromMonths(ageMonths),
    ageMonths: null,
    birthMonth,
    birthYear,
    gender,
    label,
    notificationCadence: formState.notificationCadence
  };
}

function buildFormStateFromProfile(childProfile: ChildProfile): ChildProfileFormState {
  if (childProfile.birthMonth && childProfile.birthYear) {
    return {
      ageInputMode: "birth",
      ageMonths: "",
      birthMonth: String(childProfile.birthMonth),
      birthYear: String(childProfile.birthYear),
      gender: childProfile.gender ?? "prefer_not_to_say",
      label: formatChildLabel(childProfile.label),
      notificationCadence: childProfile.notificationCadence
    };
  }

  return {
    ageInputMode: "months",
    ageMonths: childProfile.ageMonths !== null ? String(childProfile.ageMonths) : "",
    birthMonth: DEFAULT_FORM_STATE.birthMonth,
    birthYear: DEFAULT_FORM_STATE.birthYear,
    gender: childProfile.gender ?? "prefer_not_to_say",
    label: formatChildLabel(childProfile.label),
    notificationCadence: childProfile.notificationCadence
  };
}

function deriveAgeBandFromMonths(ageMonths: number): ChildAgeBand {
  if (ageMonths < 0) {
    return "expecting";
  }

  if (ageMonths < 3) {
    return "newborn_0_3";
  }

  if (ageMonths < 6) {
    return "infant_3_6";
  }

  if (ageMonths < 12) {
    return "infant_6_12";
  }

  if (ageMonths < 24) {
    return "toddler_12_24";
  }

  if (ageMonths < 36) {
    return "preschool_24_36";
  }

  return "child_3_plus";
}

function calculateAgeMonthsFromBirthMonthYear(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;
  const birthMonthIndex = birthYear * 12 + birthMonth;

  return Math.max(0, currentMonth - birthMonthIndex);
}

function formatAgeSummary(childProfile: ChildProfile): string {
  if (childProfile.ageMonths !== null) {
    return `${childProfile.ageMonths} ay`;
  }

  if (childProfile.birthMonth && childProfile.birthYear) {
    return `${MONTH_OPTIONS[childProfile.birthMonth - 1] ?? ""} ${childProfile.birthYear} doğumlu`;
  }

  return formatAgeBand(childProfile.ageBand);
}

function formatAgeBand(ageBand: ChildAgeBand): string {
  const labels: Record<ChildAgeBand, string> = {
    expecting: "Bekleniyor",
    newborn_0_3: "0-3 ay",
    infant_3_6: "3-6 ay",
    infant_6_12: "6-12 ay",
    toddler_12_24: "12-24 ay",
    preschool_24_36: "24-36 ay",
    child_3_plus: "3 yaş üzeri"
  };

  return labels[ageBand];
}

function formatGender(gender: ChildProfileGender | null): string {
  if (gender === "female") {
    return "Kız";
  }

  if (gender === "male") {
    return "Erkek";
  }

  return "Belirtmek istemiyorum";
}

function formatNotificationCadence(cadence: ChildProfileNotificationCadence): string {
  if (cadence === "monthly") {
    return "Aylık";
  }

  if (cadence === "yearly") {
    return "Yıllık";
  }

  return "Kapalı";
}

function formatChildLabel(label: string): string {
  return label.trim() || "Çocuğum";
}

function buildModeButtonClass(isActive: boolean): string {
  return [
    "rounded-2xl border px-3 py-3 text-left text-sm font-black transition",
    isActive
      ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-100"
      : "border-border bg-background text-muted-foreground hover:border-rose-200 hover:text-foreground"
  ].join(" ");
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

function buildAssistantPromptHref(
  childProfile: ChildProfile,
  recommendation: LifecycleRecommendationGroup["recommendations"][number]
): string {
  const prompt = `${formatChildLabel(childProfile.label)} için ${formatAgeBand(childProfile.ageBand)} döneminde ${recommendation.categoryName} alırken nelere dikkat etmeliyim?`;

  return `/assistant?${new URLSearchParams({ prompt }).toString()}`;
}

