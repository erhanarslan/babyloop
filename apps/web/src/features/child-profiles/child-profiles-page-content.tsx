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
  Textarea,
  TextInput
} from "../../components/ui";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { ListingImageFrame } from "../listings/listing-image-frame";
import { formatListingPrice } from "../listings/listing-display";
import { formatListingAgeRange } from "../listings/listing-age-range";
import {
  buildDefaultWebChildReminderFormState,
  buildWebChildReminderCreatePayloadFromState,
  type WebChildReminderFormState
} from "./child-reminder-form-model";
import {
  archiveChildProfileNote,
  cancelChildProfileReminder,
  createChildProfileNote,
  createChildProfile,
  createChildProfileReminder,
  deleteChildProfile,
  fetchChildProfileNotes,
  fetchChildProfileReminders,
  fetchChildProfiles,
  fetchLifecycleRecommendations,
  updateChildProfile,
  updateChildProfileReminderStatus,
  type ChildAgeBand,
  type ChildProfileNote,
  type ChildProfile,
  type ChildProfileGender,
  type ChildProfileNotificationCadence,
  type ChildProfileReminder,
  type LifecycleRecommendationGroup
} from "./api";

type ChildProfilesPageContentProps = {
  apiBaseUrl: string;
};

type EditorMode = "view" | "new" | "edit";
type AgeInputMode = "months" | "birth";
type RecommendationsLoadStatus = "loading" | "ready" | "error";

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
  const [recommendationsStatus, setRecommendationsStatus] = useState<RecommendationsLoadStatus>("loading");
  const [notesByChildId, setNotesByChildId] = useState<Record<string, ChildProfileNote[]>>({});
  const [remindersByChildId, setRemindersByChildId] = useState<Record<string, ChildProfileReminder[]>>({});
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
  const selectedNotes = selectedChildProfile ? notesByChildId[selectedChildProfile.id] ?? [] : [];
  const selectedReminders = selectedChildProfile ? remindersByChildId[selectedChildProfile.id] ?? [] : [];

  const loadChildProfiles = useCallback(async () => {
    if (!(await requireAuth())) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setRecommendationsStatus("loading");

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
      const nextNotesByChildId: Record<string, ChildProfileNote[]> = {};
      const nextRemindersByChildId: Record<string, ChildProfileReminder[]> = {};

      await Promise.all(nextChildProfiles.map(async (childProfile) => {
        const [notesResponse, remindersResponse] = await Promise.all([
          fetchChildProfileNotes(apiBaseUrl, childProfile.id),
          fetchChildProfileReminders(apiBaseUrl, childProfile.id)
        ]);

        if (notesResponse.ok) {
          nextNotesByChildId[childProfile.id] = notesResponse.data.notes;
        }

        if (remindersResponse.ok) {
          nextRemindersByChildId[childProfile.id] = remindersResponse.data.reminders;
        }
      }));

      setChildProfiles(nextChildProfiles);
      setNotesByChildId(nextNotesByChildId);
      setRemindersByChildId(nextRemindersByChildId);
      setRecommendationGroups(lifecycleRecommendationsResponse.ok ? lifecycleRecommendationsResponse.data.groups : []);
      setRecommendationsStatus(lifecycleRecommendationsResponse.ok ? "ready" : "error");
      setSelectedChildProfileId((currentId) => {
        if (currentId && nextChildProfiles.some((childProfile) => childProfile.id === currentId)) {
          return currentId;
        }

        return nextChildProfiles[0]?.id ?? null;
      });
      setEditorMode(nextChildProfiles.length > 0 ? "view" : "new");
    } catch {
      setRecommendationGroups([]);
      setRecommendationsStatus("error");
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

    if (!formState.label.trim()) {
      setMessage({ tone: "error", text: "Çocuk profili için isim veya etiket ekle." });
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

  async function handleDelete(childProfile: ChildProfile) {
    const confirmed = window.confirm("Bu çocuk profilini silmek istediğine emin misin?");

    if (!confirmed) {
      return;
    }

    const response = await deleteChildProfile(apiBaseUrl, childProfile.id);

    if (!response.ok) {
      setMessage({ tone: "error", text: "Silme işlemi tamamlanamadı." });
      return;
    }

    await loadChildProfiles();
    setMessage({ tone: "info", text: "Çocuk bilgisi silindi." });
  }

  async function handleCreateNote(childProfile: ChildProfile, title: string) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setMessage({ tone: "error", text: "Not başlığı gerekli." });
      return;
    }

    const response = await createChildProfileNote(apiBaseUrl, childProfile.id, {
      noteType: "general",
      title: trimmedTitle,
      body: null
    });

    if (!response.ok) {
      setMessage({ tone: "error", text: "Not eklenemedi." });
      return;
    }

    setNotesByChildId((current) => ({
      ...current,
      [childProfile.id]: [response.data.note, ...(current[childProfile.id] ?? [])]
    }));
    setMessage({ tone: "info", text: "Not eklendi." });
  }

  async function handleArchiveNote(childProfile: ChildProfile, noteId: string) {
    const response = await archiveChildProfileNote(apiBaseUrl, childProfile.id, noteId);

    if (!response.ok) {
      setMessage({ tone: "error", text: "Not arşivlenemedi." });
      return;
    }

    setNotesByChildId((current) => ({
      ...current,
      [childProfile.id]: (current[childProfile.id] ?? []).filter((note) => note.id !== noteId)
    }));
    setMessage({ tone: "info", text: "Not arşivlendi." });
  }

  async function handleCreateReminder(childProfile: ChildProfile, formState: WebChildReminderFormState) {
    const result = buildWebChildReminderCreatePayloadFromState(formState);

    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }

    const response = await createChildProfileReminder(apiBaseUrl, childProfile.id, result.payload);

    if (!response.ok) {
      setMessage({ tone: "error", text: "Hatırlatıcı eklenemedi." });
      return;
    }

    setRemindersByChildId((current) => ({
      ...current,
      [childProfile.id]: [...(current[childProfile.id] ?? []), response.data.reminder]
    }));
    setMessage({ tone: "info", text: "Hatırlatıcı eklendi." });
  }

  async function handleUpdateReminderStatus(
    childProfile: ChildProfile,
    reminderId: string,
    status: ChildProfileReminder["status"]
  ) {
    const response = await updateChildProfileReminderStatus(apiBaseUrl, childProfile.id, reminderId, status);

    if (!response.ok) {
      setMessage({ tone: "error", text: "Hatırlatıcı güncellenemedi." });
      return;
    }

    setRemindersByChildId((current) => ({
      ...current,
      [childProfile.id]: (current[childProfile.id] ?? []).map((reminder) =>
        reminder.id === reminderId ? response.data.reminder : reminder
      )
    }));
  }

  async function handleCancelReminder(childProfile: ChildProfile, reminderId: string) {
    const response = await cancelChildProfileReminder(apiBaseUrl, childProfile.id, reminderId);

    if (!response.ok) {
      setMessage({ tone: "error", text: "Hatırlatıcı silinemedi." });
      return;
    }

    setRemindersByChildId((current) => ({
      ...current,
      [childProfile.id]: (current[childProfile.id] ?? []).filter((reminder) => reminder.id !== reminderId)
    }));
    setMessage({ tone: "info", text: "Hatırlatıcı iptal edildi." });
  }

  return (
    <PageContainer className="max-w-6xl py-8 sm:py-10" ariaLabel="Çocuğum">
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Çocuğum</h1>
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
              apiBaseUrl={apiBaseUrl}
              childProfile={selectedChildProfile}
              recommendationGroup={selectedRecommendationGroup}
              recommendationsStatus={recommendationsStatus}
              notes={selectedNotes}
              reminders={selectedReminders}
              onArchiveNote={(noteId) => void handleArchiveNote(selectedChildProfile, noteId)}
              onCancelReminder={(reminderId) => void handleCancelReminder(selectedChildProfile, reminderId)}
              onCompleteReminder={(reminderId) => void handleUpdateReminderStatus(selectedChildProfile, reminderId, "completed")}
              onCreateNote={(title) => void handleCreateNote(selectedChildProfile, title)}
              onCreateReminder={(formState) => void handleCreateReminder(selectedChildProfile, formState)}
              onDelete={() => void handleDelete(selectedChildProfile)}
              onEdit={() => startEditProfile(selectedChildProfile)}
              onPauseReminder={(reminderId) => void handleUpdateReminderStatus(selectedChildProfile, reminderId, "paused")}
              onResumeReminder={(reminderId) => void handleUpdateReminderStatus(selectedChildProfile, reminderId, "scheduled")}
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
        placeholder="İsim ekle"
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
              max={216}
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
  apiBaseUrl,
  childProfile,
  recommendationGroup,
  recommendationsStatus,
  notes,
  reminders,
  onArchiveNote,
  onCancelReminder,
  onCompleteReminder,
  onCreateNote,
  onCreateReminder,
  onDelete,
  onEdit,
  onPauseReminder,
  onResumeReminder,
}: {
  apiBaseUrl: string;
  childProfile: ChildProfile;
  recommendationGroup: LifecycleRecommendationGroup | null;
  recommendationsStatus: RecommendationsLoadStatus;
  notes: ChildProfileNote[];
  reminders: ChildProfileReminder[];
  onArchiveNote: (noteId: string) => void;
  onCancelReminder: (reminderId: string) => void;
  onCompleteReminder: (reminderId: string) => void;
  onCreateNote: (title: string) => void;
  onCreateReminder: (formState: WebChildReminderFormState) => void;
  onDelete: () => void;
  onEdit: () => void;
  onPauseReminder: (reminderId: string) => void;
  onResumeReminder: (reminderId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-2xl font-black tracking-tight text-foreground">
          {formatChildLabel(childProfile.label)}
        </h2>
        <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
          {childProfile.isActive ? "Aktif" : "Pasif"}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <SummaryItem label="Yaş" value={formatAgeSummary(childProfile)} />
        <SummaryItem label="Cinsiyet" value={formatGender(childProfile.gender)} />
      </dl>

      <ChildNotebookPanel
        notes={notes}
        reminders={reminders}
        onArchiveNote={onArchiveNote}
        onCancelReminder={onCancelReminder}
        onCompleteReminder={onCompleteReminder}
        onCreateNote={onCreateNote}
        onCreateReminder={onCreateReminder}
        onPauseReminder={onPauseReminder}
        onResumeReminder={onResumeReminder}
      />

      <ChildLifecycleRecommendations
        apiBaseUrl={apiBaseUrl}
        childProfile={childProfile}
        recommendationGroup={recommendationGroup}
        status={recommendationsStatus}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onEdit}>
          Düzenle
        </Button>
        <Button type="button" variant="secondary" onClick={onDelete}>
          Sil
        </Button>
      </div>
    </div>
  );
}

function ChildNotebookPanel({
  notes,
  reminders,
  onArchiveNote,
  onCancelReminder,
  onCompleteReminder,
  onCreateNote,
  onCreateReminder,
  onPauseReminder,
  onResumeReminder
}: {
  notes: ChildProfileNote[];
  reminders: ChildProfileReminder[];
  onArchiveNote: (noteId: string) => void;
  onCancelReminder: (reminderId: string) => void;
  onCompleteReminder: (reminderId: string) => void;
  onCreateNote: (title: string) => void;
  onCreateReminder: (formState: WebChildReminderFormState) => void;
  onPauseReminder: (reminderId: string) => void;
  onResumeReminder: (reminderId: string) => void;
}) {
  const [noteTitle, setNoteTitle] = useState("");
  const [reminderForm, setReminderForm] = useState<WebChildReminderFormState>(
    () => buildDefaultWebChildReminderFormState()
  );
  const hasNotebookItems = notes.length > 0 || reminders.length > 0;

  return (
    <section className="rounded-[1.25rem] border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-black text-foreground">Notlar ve hatırlatıcılar</h3>
        <Link
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black text-foreground"
          href="/account/notification-preferences"
        >
          Bildirimler
        </Link>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <form
          className="rounded-2xl border border-border bg-background/80 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateNote(noteTitle);
            setNoteTitle("");
          }}
        >
          <TextInput
            label="Yeni not"
            maxLength={100}
            onChange={(event) => setNoteTitle(event.target.value)}
            placeholder="Örn. Bez stoğu azaldı"
            value={noteTitle}
          />
          <Button className="mt-2" type="submit" variant="secondary">
            Not ekle
          </Button>
        </form>
        <form
          className="rounded-2xl border border-border bg-background/80 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateReminder(reminderForm);
            setReminderForm(buildDefaultWebChildReminderFormState());
          }}
        >
          <TextInput
            label="Yeni hatırlatıcı"
            maxLength={120}
            onChange={(event) => setReminderForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Örn. Hafta sonu bez al"
            value={reminderForm.title}
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Select
              label="Tür"
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  reminderType: event.target.value as ChildProfileReminder["reminderType"]
                }))
              }
              value={reminderForm.reminderType}
            >
              <option value="shopping">Alışveriş</option>
              <option value="feeding">Beslenme</option>
              <option value="diaper">Bez</option>
              <option value="sleep">Uyku</option>
              <option value="activity">Aktivite</option>
              <option value="appointment">Randevu</option>
              <option value="general">Genel</option>
            </Select>
            <Select
              label="Zamanlama"
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  scheduleKind: event.target.value as ChildProfileReminder["scheduleKind"]
                }))
              }
              value={reminderForm.scheduleKind}
            >
              <option value="one_time">Tek seferlik</option>
              <option value="daily">Günlük</option>
              <option value="weekly">Haftalık</option>
              <option value="interval">Aralıklı</option>
              <option value="relative_before_event">Randevudan önce</option>
            </Select>
          </div>
          {reminderForm.scheduleKind === "one_time" ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <TextInput
                label="Tarih"
                onChange={(event) => setReminderForm((current) => ({ ...current, oneTimeDate: event.target.value }))}
                type="date"
                value={reminderForm.oneTimeDate}
              />
              <TextInput
                label="Saat"
                onChange={(event) => setReminderForm((current) => ({ ...current, oneTimeTime: event.target.value }))}
                type="time"
                value={reminderForm.oneTimeTime}
              />
            </div>
          ) : null}
          {reminderForm.scheduleKind === "daily" || reminderForm.scheduleKind === "weekly" ? (
            <div className="mt-2">
              <TextInput
                label="Saat"
                onChange={(event) => setReminderForm((current) => ({ ...current, localTime: event.target.value }))}
                type="time"
                value={reminderForm.localTime}
              />
            </div>
          ) : null}
          {reminderForm.scheduleKind === "interval" ? (
            <div className="mt-2">
              <TextInput
                label="Kaç dakikada bir"
                min={15}
                onChange={(event) => setReminderForm((current) => ({ ...current, intervalMinutes: event.target.value }))}
                type="number"
                value={reminderForm.intervalMinutes}
              />
            </div>
          ) : null}
          {reminderForm.scheduleKind === "relative_before_event" ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <TextInput
                label="Etkinlik tarihi"
                onChange={(event) => setReminderForm((current) => ({ ...current, eventDate: event.target.value }))}
                type="date"
                value={reminderForm.eventDate}
              />
              <TextInput
                label="Etkinlik saati"
                onChange={(event) => setReminderForm((current) => ({ ...current, eventTime: event.target.value }))}
                type="time"
                value={reminderForm.eventTime}
              />
              <TextInput
                label="Kaç dakika önce"
                min={1}
                onChange={(event) =>
                  setReminderForm((current) => ({ ...current, notifyBeforeMinutes: event.target.value }))
                }
                type="number"
                value={reminderForm.notifyBeforeMinutes}
              />
            </div>
          ) : null}
          <div className="mt-2">
            <Textarea
              label="Not"
              maxLength={500}
              onChange={(event) => setReminderForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="İsteğe bağlı kısa açıklama"
              value={reminderForm.description}
            />
          </div>
          <Button className="mt-2" type="submit" variant="secondary">
            Hatırlatıcı oluştur
          </Button>
        </form>
      </div>

      {!hasNotebookItems ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-background/70 p-3 text-sm font-semibold text-muted-foreground">
          Henüz not veya hatırlatıcı yok. İlk notu ekle ya da hatırlatıcı oluştur.
        </p>
      ) : null}

      {notes.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {notes.slice(0, 4).map((note) => (
            <article className="rounded-2xl border border-border bg-background/80 p-3" key={note.id}>
              <strong className="block text-sm font-black text-foreground">{note.title}</strong>
              <span className="mt-1 block text-xs font-bold text-muted-foreground">
                {note.body ?? formatNoteType(note.noteType)}
              </span>
              <Button className="mt-2" type="button" variant="secondary" onClick={() => onArchiveNote(note.id)}>
                Arşivle
              </Button>
            </article>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {reminders.slice(0, 5).map((reminder) => (
          <article className="rounded-2xl border border-border bg-background/80 p-3" key={reminder.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong className="block text-sm font-black text-foreground">{reminder.title}</strong>
                <span className="mt-1 block text-xs font-bold text-muted-foreground">
                  {formatReminderSchedule(reminder)} · {formatReminderStatus(reminder.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {reminder.status === "paused" ? (
                  <Button type="button" variant="secondary" onClick={() => onResumeReminder(reminder.id)}>
                    Sürdür
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => onPauseReminder(reminder.id)}>
                    Duraklat
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => onCompleteReminder(reminder.id)}>
                  Tamamla
                </Button>
                <Button type="button" variant="secondary" onClick={() => onCancelReminder(reminder.id)}>
                  İptal
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function ChildLifecycleRecommendations({
  apiBaseUrl,
  childProfile,
  recommendationGroup,
  status
}: {
  apiBaseUrl: string;
  childProfile: ChildProfile;
  recommendationGroup: LifecycleRecommendationGroup | null;
  status: RecommendationsLoadStatus;
}) {
  const { dictionary } = useI18n();

  if (!childProfile.isActive) {
    return null;
  }

  const recommendations = recommendationGroup?.recommendations ?? [];
  const matchedListings = recommendationGroup?.matchedListings ?? [];

  return (
    <section
      aria-label="Yaşa göre öneriler"
      className="rounded-[1.25rem] border border-border bg-background/75 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-foreground">Yaşa uygun ilanlar</h3>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Güncel yaş bilgisine ve satıcının belirttiği yaş aralığına göre eşleşir.
          </p>
        </div>
        <Link
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black text-foreground"
          href={buildAssistantPromptHref(childProfile)}
        >
          Asistana sor
        </Link>
      </div>

      <p className="mt-3 rounded-2xl border border-amber-300/45 bg-amber-50/70 p-3 text-xs font-bold leading-5 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-100">
        Yaş eşleşmesi güvenlik veya beden uyumu garantisi değildir. Üretici etiketini,
        ölçüleri ve ürün durumunu kontrol et.
      </p>

      {status === "loading" ? (
        <div className="mt-3">
          <LoadingBlock title="İlanlar hazırlanıyor" message="Güncel yaş eşleşmeleri kontrol ediliyor." />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-3">
          <Alert
            title="Yaşa uygun ilanlar yüklenemedi"
            message="İlan eşleşmeleri şu anda alınamıyor. Biraz sonra tekrar dene."
          />
        </div>
      ) : null}

      {status === "ready" && matchedListings.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm font-semibold text-muted-foreground">
          Güncel yaşa uygun yayında ilan bulunamadı.
        </p>
      ) : null}

      {status === "ready" && matchedListings.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {matchedListings.map((listing) => (
            <article
              className="overflow-hidden rounded-2xl border border-border bg-background"
              key={listing.id}
            >
              <Link className="block" href={`/listings/${listing.id}`}>
                <ListingImageFrame
                  alt={`Ürün görseli: ${listing.title}`}
                  apiBaseUrl={apiBaseUrl}
                  className="aspect-[4/3] w-full"
                  fallbackLabel="Görsel yok"
                  url={listing.firstImage?.url ?? null}
                />
                <div className="p-3">
                  <strong className="line-clamp-2 block text-sm font-black text-foreground">
                    {listing.title}
                  </strong>
                  <span className="mt-1 block text-sm font-black text-foreground">
                    {formatListingPrice(listing.price, dictionary)}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-muted-foreground">
                    {formatListingAgeRange(
                      listing.recommendedAgeMinMonths,
                      listing.recommendedAgeMaxMonths
                    )}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-border bg-muted/15 p-3">
          <summary className="cursor-pointer text-sm font-black text-foreground">
            Kategori fikirleri ({recommendations.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {recommendations.slice(0, 4).map((recommendation) => (
              <article
                className="rounded-2xl border border-border bg-background p-3"
                key={`${recommendation.categoryId}-${recommendation.reasonCode}`}
              >
                <strong className="block text-sm font-black text-foreground">
                  {recommendation.categoryName}
                </strong>
                <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                  {recommendation.whyNow || recommendation.reasonLabel}
                </span>
                <Link
                  className="mt-3 inline-flex rounded-full bg-foreground px-3 py-1.5 text-xs font-black text-background"
                  href={buildRecommendationBrowseHref(recommendation)}
                >
                  İlanlar
                </Link>
              </article>
            ))}
          </div>
        </details>
      ) : null}
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
  const label = formState.label.trim();
  const gender = formState.gender;

  if (!label) {
    return null;
  }

  if (formState.ageInputMode === "months") {
    const ageMonths = Number.parseInt(formState.ageMonths, 10);

    if (!Number.isInteger(ageMonths) || ageMonths < 0 || ageMonths > 216) {
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
      label: getEditableChildLabel(childProfile.label),
      notificationCadence: childProfile.notificationCadence
    };
  }

  return {
    ageInputMode: "months",
    ageMonths: childProfile.ageMonths !== null ? String(childProfile.ageMonths) : "",
    birthMonth: DEFAULT_FORM_STATE.birthMonth,
    birthYear: DEFAULT_FORM_STATE.birthYear,
    gender: childProfile.gender ?? "prefer_not_to_say",
    label: getEditableChildLabel(childProfile.label),
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

function formatNoteType(noteType: ChildProfileNote["noteType"]): string {
  const labels: Record<ChildProfileNote["noteType"], string> = {
    general: "Genel not",
    feeding: "Beslenme",
    diaper: "Bez",
    sleep: "Uyku",
    activity: "Etkinlik",
    shopping: "Alışveriş",
    health_note: "Sağlık notu",
    size: "Beden / ölçü",
    preference: "Tercih",
    daycare: "Okul / bakım",
    milestone: "Gelişim notu"
  };

  return labels[noteType];
}

function formatReminderStatus(status: ChildProfileReminder["status"]): string {
  const labels: Record<ChildProfileReminder["status"], string> = {
    scheduled: "Planlandı",
    paused: "Duraklatıldı",
    completed: "Tamamlandı",
    cancelled: "İptal"
  };

  return labels[status];
}

function formatReminderDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatReminderSchedule(reminder: ChildProfileReminder): string {
  if (reminder.scheduleKind === "interval" && reminder.intervalMinutes) {
    return `${reminder.intervalMinutes} dakikada bir`;
  }

  if (reminder.scheduleKind === "daily" && reminder.localTime) {
    return `Her gün ${reminder.localTime}`;
  }

  if (reminder.scheduleKind === "weekly" && reminder.localTime) {
    return `Haftalık ${reminder.localTime}`;
  }

  if (reminder.scheduleKind === "relative_before_event" && reminder.eventAt) {
    const notifyLabel = reminder.notifyBeforeMinutes
      ? `${reminder.notifyBeforeMinutes} dakika önce`
      : "Randevudan önce";

    return `${formatReminderDate(reminder.eventAt)} · ${notifyLabel}`;
  }

  return formatReminderDate(reminder.nextRunAt ?? reminder.remindAt);
}

function formatChildLabel(label: string): string {
  return getEditableChildLabel(label) || "İsim ekle";
}

function getEditableChildLabel(label: string): string {
  const trimmed = label.trim();

  return trimmed === "Çocuğum" ? "" : trimmed;
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
    sort: "newest",
    hasImages: "true"
  });

  return `/browse?${params.toString()}`;
}

function buildAssistantPromptHref(
  childProfile: ChildProfile
): string {
  const childLabel = getEditableChildLabel(childProfile.label);
  const prompt = `${childLabel ? `${childLabel} için` : "Çocuğum için"} ${formatAgeBand(childProfile.ageBand)} döneminde ürün seçerken nelere dikkat etmeliyim?`;

  return `/assistant?${new URLSearchParams({ prompt }).toString()}`;
}
