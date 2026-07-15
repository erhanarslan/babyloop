import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  MobileButton,
  MobileCard,
  MobileChip,
  MobileEmptyState,
  MobileErrorState,
  MobileSectionHeader,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import { Screen } from "../../ui/screen";
import { colors, radius, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  archiveMobileChildNote,
  cancelMobileChildReminder,
  completeMobileChildReminder,
  createMobileChildNote,
  createMobileChildProfile,
  createMobileChildReminder,
  fetchMobileChildNotes,
  fetchMobileChildProfiles,
  fetchMobileChildReminders,
  updateMobileChildNote,
  updateMobileChildReminder,
  type MobileChildNote,
  type MobileChildProfile,
  type MobileChildReminder
} from "./child-reminders-api";
import { getDefaultMobileChildProfilePayload } from "./child-reminders-model";
import {
  MobileChildDateTimeField,
  MobileChildLocalTimeField
} from "./child-reminder-date-time-fields";
import {
  appendMobileChildReminder,
  buildMobileChildNoteCreatePayloadFromState,
  buildMobileChildNoteUpdatePayloadFromState,
  buildMobileChildReminderCreatePayloadFromState,
  buildMobileChildReminderUpdatePayloadFromState,
  canRunMobileChildProfileAction,
  createMobileChildNoteFormState,
  createMobileChildReminderFormState,
  createMobileChildReminderFormStateFromReminder,
  getMobileChildDeliveryBoundaryText,
  getMobileChildMutationMessage,
  getMobileChildProfileMetaLabel,
  getMobileChildReminderScheduleLabel,
  getPreferredMobileChildProfile,
  mobileChildNoteTypeOptions,
  mobileChildReminderTypeOptions,
  prependMobileChildNote,
  removeMobileChildNote,
  removeMobileChildReminder,
  replaceMobileChildNote,
  replaceMobileChildReminder,
  type MobileChildNoteFormState,
  type MobileChildReminderFormState
} from "./child-reminder-screen-state-model";

type ScreenStatus = "loading" | "ready" | "error";
type ChildTab = "notes" | "reminders";

export function ChildProfileScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [childProfile, setChildProfile] = useState<MobileChildProfile | null>(null);
  const [notes, setNotes] = useState<MobileChildNote[]>([]);
  const [reminders, setReminders] = useState<MobileChildReminder[]>([]);
  const [noteForm, setNoteForm] = useState<MobileChildNoteFormState>(() => createMobileChildNoteFormState());
  const [reminderForm, setReminderForm] = useState<MobileChildReminderFormState>(() =>
    createMobileChildReminderFormState("shopping")
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChildTab>("notes");
  const [noteTypePickerOpen, setNoteTypePickerOpen] = useState(false);
  const [reminderTypePickerOpen, setReminderTypePickerOpen] = useState(false);
  const [status, setStatus] = useState<ScreenStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scheduledReminderCount = useMemo(
    () => reminders.filter((reminder) => reminder.status === "scheduled").length,
    [reminders]
  );

  const loadChildData = useCallback(async () => {
    if (!currentUser) {
      setChildProfile(null);
      setNotes([]);
      setReminders([]);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const profilesResponse = await fetchMobileChildProfiles();

    if (!profilesResponse.ok) {
      setStatus("error");
      setMessage(redactMobileChildMessage(profilesResponse.error.message));
      return;
    }

    let nextProfile = getPreferredMobileChildProfile(profilesResponse.data.childProfiles);

    if (!nextProfile) {
      const createResponse = await createMobileChildProfile(getDefaultMobileChildProfilePayload());

      if (!createResponse.ok) {
        setStatus("error");
        setMessage(redactMobileChildMessage(createResponse.error.message));
        return;
      }

      nextProfile = createResponse.data.childProfile;
    }

    const [notesResponse, remindersResponse] = await Promise.all([
      fetchMobileChildNotes(nextProfile.id),
      fetchMobileChildReminders(nextProfile.id)
    ]);

    if (!notesResponse.ok) {
      setStatus("error");
      setMessage(redactMobileChildMessage(notesResponse.error.message));
      return;
    }

    if (!remindersResponse.ok) {
      setStatus("error");
      setMessage(redactMobileChildMessage(remindersResponse.error.message));
      return;
    }

    setChildProfile(nextProfile);
    setNotes(notesResponse.data.notes);
    setReminders(remindersResponse.data.reminders);
    setStatus("ready");
  }, [currentUser]);

  useEffect(() => {
    void loadChildData();
  }, [loadChildData]);

  async function handleSubmitNote() {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    if (editingNoteId) {
      const payloadResult = buildMobileChildNoteUpdatePayloadFromState(noteForm);

      if (!payloadResult.ok) {
        setMessage(payloadResult.message);
        setIsSubmitting(false);
        return;
      }

      const response = await updateMobileChildNote(childProfile.id, editingNoteId, payloadResult.payload);

      if (!response.ok) {
        setMessage(redactMobileChildMessage(response.error.message));
        setIsSubmitting(false);
        return;
      }

      setNotes((current) => replaceMobileChildNote(current, editingNoteId, response.data.note));
      setMessage(getMobileChildMutationMessage("note_updated"));
    } else {
      const payloadResult = buildMobileChildNoteCreatePayloadFromState(noteForm);

      if (!payloadResult.ok) {
        setMessage(payloadResult.message);
        setIsSubmitting(false);
        return;
      }

      const response = await createMobileChildNote(childProfile.id, payloadResult.payload);

      if (!response.ok) {
        setMessage(redactMobileChildMessage(response.error.message));
        setIsSubmitting(false);
        return;
      }

      setNotes((current) => prependMobileChildNote(current, response.data.note));
      setMessage(getMobileChildMutationMessage("note_created"));
    }

    setNoteForm(createMobileChildNoteFormState());
    setEditingNoteId(null);
    setIsSubmitting(false);
  }

  async function handleArchiveNote(noteId: string) {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await archiveMobileChildNote(childProfile.id, noteId);

    if (!response.ok) {
      setMessage(redactMobileChildMessage(response.error.message));
      setIsSubmitting(false);
      return;
    }

    setNotes((current) => removeMobileChildNote(current, noteId));
    setMessage(getMobileChildMutationMessage("note_archived"));
    setIsSubmitting(false);
  }

  async function handleSubmitReminder() {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    if (editingReminderId) {
      const payloadResult = buildMobileChildReminderUpdatePayloadFromState(reminderForm);

      if (!payloadResult.ok) {
        setMessage(payloadResult.message);
        setIsSubmitting(false);
        return;
      }

      const response = await updateMobileChildReminder(childProfile.id, editingReminderId, payloadResult.payload);

      if (!response.ok) {
        setMessage(redactMobileChildMessage(response.error.message));
        setIsSubmitting(false);
        return;
      }

      setReminders((current) => replaceMobileChildReminder(current, editingReminderId, response.data.reminder));
      setMessage(getMobileChildMutationMessage("reminder_updated"));
    } else {
      const payloadResult = buildMobileChildReminderCreatePayloadFromState(reminderForm);

      if (!payloadResult.ok) {
        setMessage(payloadResult.message);
        setIsSubmitting(false);
        return;
      }

      const response = await createMobileChildReminder(childProfile.id, payloadResult.payload);

      if (!response.ok) {
        setMessage(redactMobileChildMessage(response.error.message));
        setIsSubmitting(false);
        return;
      }

      setReminders((current) => appendMobileChildReminder(current, response.data.reminder));
      setMessage(getMobileChildMutationMessage("reminder_created"));
    }

    setReminderForm(createMobileChildReminderFormState("shopping"));
    setEditingReminderId(null);
    setIsSubmitting(false);
  }

  async function handleCompleteReminder(reminderId: string) {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await completeMobileChildReminder(childProfile.id, reminderId);

    if (!response.ok) {
      setMessage(redactMobileChildMessage(response.error.message));
      setIsSubmitting(false);
      return;
    }

    setReminders((current) => replaceMobileChildReminder(current, reminderId, response.data.reminder));
    setMessage(getMobileChildMutationMessage("reminder_completed"));
    setIsSubmitting(false);
  }

  async function handleCancelReminder(reminderId: string) {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await cancelMobileChildReminder(childProfile.id, reminderId);

    if (!response.ok) {
      setMessage(redactMobileChildMessage(response.error.message));
      setIsSubmitting(false);
      return;
    }

    setReminders((current) => removeMobileChildReminder(current, reminderId));
    setMessage(getMobileChildMutationMessage("reminder_cancelled"));
    setIsSubmitting(false);
  }

  function startNoteEdit(note: MobileChildNote): void {
    setActiveTab("notes");
    setEditingNoteId(note.id);
    setNoteForm(createMobileChildNoteFormState(note));
    setMessage(null);
  }

  function startReminderEdit(reminder: MobileChildReminder): void {
    setActiveTab("reminders");
    setEditingReminderId(reminder.id);
    setReminderForm(createMobileChildReminderFormStateFromReminder(reminder));
    setMessage(null);
  }

  if (!currentUser) {
    return (
      <Screen eyebrow="Çocuğum" title="Giriş gerekli" subtitle="Notlar ve hatırlatıcılar hesabına bağlıdır.">
        <MobileEmptyState
          actionLabel="Giriş yap"
          message="Çocuğuna özel not ve hatırlatıcıları kullanmak için giriş yap."
          onAction={() => router.push("/login")}
          title="Hesabına giriş yap"
        />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Çocuğum"
      title={childProfile?.label ?? "Not defteri"}
      subtitle={getMobileChildDeliveryBoundaryText()}
      headerAction={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/notification-preferences")}
          style={styles.headerLink}
        >
          <Text style={styles.headerLinkText}>Tercihler</Text>
        </Pressable>
      }
    >
      <MobileCard style={styles.heroCard}>
        <View style={styles.statsGrid}>
          <StatChip label="Not" value={notes.length.toString()} />
          <StatChip label="Hatırlatıcı" value={reminders.length.toString()} />
          <StatChip label="Aktif" value={scheduledReminderCount.toString()} />
        </View>
      </MobileCard>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {status === "loading" ? <MobileSkeleton label="Çocuk notları yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={message}
          onAction={() => void loadChildData()}
          title="Çocuk notları yüklenemedi"
        />
      ) : null}

      <View style={styles.tabRow}>
        <TabButton active={activeTab === "notes"} label="Not defteri" onPress={() => setActiveTab("notes")} />
        <TabButton active={activeTab === "reminders"} label="Hatırlatıcılar" onPress={() => setActiveTab("reminders")} />
      </View>

      {activeTab === "notes" ? (
        <>
          <MobileCard style={styles.formCard}>
            <MobileSectionHeader
              description="Beslenme, bez, uyku, tercih veya alışveriş notlarını çocuk profiline bağla."
              title={editingNoteId ? "Notu düzenle" : "Yeni not"}
            />

            <TextInput
              onChangeText={(title) => setNoteForm((current) => ({ ...current, title }))}
              placeholder="Örn. Bez stoğu azaldı"
              style={styles.input}
              value={noteForm.title}
            />

            <TextInput
              multiline
              onChangeText={(body) => setNoteForm((current) => ({ ...current, body }))}
              placeholder="Detay ekle"
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={noteForm.body}
            />

            <DropdownSelect
              isOpen={noteTypePickerOpen}
              label="Not tipi"
              onSelect={(noteType) => {
                setNoteForm((current) => ({ ...current, noteType: noteType as MobileChildNote["noteType"] }));
                setNoteTypePickerOpen(false);
              }}
              onToggle={() => {
                setReminderTypePickerOpen(false);
                setNoteTypePickerOpen((current) => !current);
              }}
              options={mobileChildNoteTypeOptions}
              selectedValue={noteForm.noteType}
            />

            <View style={styles.formActions}>
              <MobileButton disabled={isSubmitting} onPress={() => void handleSubmitNote()}>
                {editingNoteId ? "Notu güncelle" : "Not ekle"}
              </MobileButton>
              {editingNoteId ? (
                <MobileButton
                  disabled={isSubmitting}
                  onPress={() => {
                    setEditingNoteId(null);
                    setNoteForm(createMobileChildNoteFormState());
                  }}
                  variant="ghost"
                >
                  Vazgeç
                </MobileButton>
              ) : null}
            </View>
          </MobileCard>

          <MobileCard style={styles.listCard}>
            <MobileSectionHeader title="Notlar" description={`${notes.length} kayıt`} />
            {notes.length === 0 ? (
              <MobileEmptyState
                message="Beslenme, bez, uyku, beden veya alışveriş notlarını buradan ekleyebilirsin."
                title="Henüz not yok"
              />
            ) : null}

            <View style={styles.list}>
              {notes.map((note) => (
                <View key={note.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{note.title}</Text>
                    <MobileChip tone={note.isPinned ? "primary" : "neutral"}>
                      {formatNoteTypeLabel(note.noteType)}
                    </MobileChip>
                  </View>
                  <Text style={styles.rowText}>{note.body ?? "Detay eklenmedi."}</Text>
                  <Text style={styles.rowMeta}>{formatDate(note.updatedAt)}</Text>
                  <View style={styles.rowActions}>
                    <MobileButton disabled={isSubmitting} onPress={() => startNoteEdit(note)} variant="secondary">
                      Düzenle
                    </MobileButton>
                    <MobileButton disabled={isSubmitting} onPress={() => void handleArchiveNote(note.id)} variant="danger">
                      Arşivle
                    </MobileButton>
                  </View>
                </View>
              ))}
            </View>
          </MobileCard>
        </>
      ) : null}

      {activeTab === "reminders" ? (
        <>
          <MobileCard style={styles.formCard}>
            <MobileSectionHeader
              description="Tek seferlik, tekrarlı, günlük/haftalık veya randevu öncesi uygulama içi hatırlatıcı oluştur."
              title={editingReminderId ? "Hatırlatıcıyı düzenle" : "Yeni hatırlatıcı"}
            />

            <TextInput
              onChangeText={(title) => setReminderForm((current) => ({ ...current, title }))}
              placeholder="Örn. Hafta sonu bez al"
              style={styles.input}
              value={reminderForm.title}
            />

            <TextInput
              multiline
              onChangeText={(description) => setReminderForm((current) => ({ ...current, description }))}
              placeholder="Detay ekle"
              style={[styles.input, styles.textAreaSmall]}
              textAlignVertical="top"
              value={reminderForm.description}
            />

            <DropdownSelect
              isOpen={reminderTypePickerOpen}
              label="Hatırlatıcı tipi"
              onSelect={(reminderType) => {
                setReminderForm((current) => ({
                  ...current,
                  reminderType: reminderType as MobileChildReminder["reminderType"]
                }));
                setReminderTypePickerOpen(false);
              }}
              onToggle={() => {
                setNoteTypePickerOpen(false);
                setReminderTypePickerOpen((current) => !current);
              }}
              options={mobileChildReminderTypeOptions}
              selectedValue={reminderForm.reminderType}
            />

            <View style={styles.optionGrid}>
              {(["one_time", "interval", "daily", "weekly", "relative_before_event"] as const).map((scheduleKind) => (
                <OptionPill
                  active={reminderForm.scheduleKind === scheduleKind}
                  key={scheduleKind}
                  label={formatScheduleKindLabel(scheduleKind)}
                  onPress={() => setReminderForm((current) => ({
                    ...current,
                    scheduleKind,
                    ...(scheduleKind === "interval" && !current.intervalMinutes ? { intervalMinutes: "120" } : {}),
                    ...((scheduleKind === "daily" || scheduleKind === "weekly") && !current.localTime ? { localTime: "10:00" } : {})
                  }))}
                />
              ))}
            </View>

            {reminderForm.scheduleKind === "one_time" ? (
              <MobileChildDateTimeField
                fallbackKind="due"
                label="Hatırlatma zamanı"
                onChange={(dueAt) => setReminderForm((current) => ({ ...current, dueAt }))}
                value={reminderForm.dueAt}
              />
            ) : null}

            {reminderForm.scheduleKind === "interval" ? (
              <Field label="Kaç dakikada bir?">
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(intervalMinutes) => setReminderForm((current) => ({ ...current, intervalMinutes }))}
                  placeholder="120"
                  style={styles.input}
                  value={reminderForm.intervalMinutes}
                />
              </Field>
            ) : null}

            {reminderForm.scheduleKind === "daily" || reminderForm.scheduleKind === "weekly" ? (
              <MobileChildLocalTimeField
                label="Saat"
                onChange={(localTime) => setReminderForm((current) => ({ ...current, localTime }))}
                value={reminderForm.localTime}
              />
            ) : null}

            {reminderForm.scheduleKind === "relative_before_event" ? (
              <View style={styles.twoColumn}>
                <MobileChildDateTimeField
                  fallbackKind="event"
                  label="Etkinlik zamanı"
                  onChange={(eventAt) => setReminderForm((current) => ({ ...current, eventAt }))}
                  value={reminderForm.eventAt}
                />
                <Field label="Kaç dk önce?">
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(notifyBeforeMinutes) => setReminderForm((current) => ({ ...current, notifyBeforeMinutes }))}
                    placeholder="1440"
                    style={styles.input}
                    value={reminderForm.notifyBeforeMinutes}
                  />
                </Field>
              </View>
            ) : null}

            <View style={styles.formActions}>
              <MobileButton disabled={isSubmitting} onPress={() => void handleSubmitReminder()}>
                {editingReminderId ? "Hatırlatıcıyı güncelle" : "Hatırlatıcı ekle"}
              </MobileButton>
              {editingReminderId ? (
                <MobileButton
                  disabled={isSubmitting}
                  onPress={() => {
                    setEditingReminderId(null);
                    setReminderForm(createMobileChildReminderFormState("shopping"));
                  }}
                  variant="ghost"
                >
                  Vazgeç
                </MobileButton>
              ) : null}
            </View>
          </MobileCard>

          <MobileCard style={styles.listCard}>
            <MobileSectionHeader title="Hatırlatıcılar" description={`${reminders.length} kayıt`} />
            {reminders.length === 0 ? (
              <MobileEmptyState
                message="Alışveriş, beslenme, bez veya randevu hatırlatıcılarını buradan ekleyebilirsin."
                title="Henüz hatırlatıcı yok"
              />
            ) : null}

            <View style={styles.list}>
              {reminders.map((reminder) => (
                <View key={reminder.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{reminder.title}</Text>
                    <MobileChip tone={reminder.status === "completed" ? "success" : "warning"}>
                      {formatReminderStatusLabel(reminder.status)}
                    </MobileChip>
                  </View>
                  <Text style={styles.rowText}>
                    {reminder.description ?? getMobileChildReminderScheduleLabel(reminder)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {getMobileChildReminderScheduleLabel(reminder)} · {formatDate(reminder.remindAt)}
                  </Text>
                  <View style={styles.rowActions}>
                    <MobileButton disabled={isSubmitting} onPress={() => startReminderEdit(reminder)} variant="secondary">
                      Düzenle
                    </MobileButton>
                    {reminder.status !== "completed" ? (
                      <MobileButton disabled={isSubmitting} onPress={() => void handleCompleteReminder(reminder.id)} variant="secondary">
                        Tamamla
                      </MobileButton>
                    ) : null}
                    <MobileButton disabled={isSubmitting} onPress={() => void handleCancelReminder(reminder.id)} variant="danger">
                      İptal
                    </MobileButton>
                  </View>
                </View>
              ))}
            </View>
          </MobileCard>
        </>
      ) : null}
    </Screen>
  );
}

function DropdownSelect({
  isOpen,
  label,
  onSelect,
  onToggle,
  options,
  selectedValue
}: {
  isOpen: boolean;
  label: string;
  onSelect: (value: string) => void;
  onToggle: () => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  selectedValue: string;
}) {
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? "Seç";

  return (
    <View style={styles.dropdown}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.dropdownButton}>
        <Text style={styles.dropdownButtonText}>{selectedLabel}</Text>
        <Text style={styles.dropdownChevron}>{isOpen ? "▲" : "▼"}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.dropdownMenu}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === selectedValue }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.dropdownOption,
                option.value === selectedValue ? styles.dropdownOptionSelected : null
              ]}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  option.value === selectedValue ? styles.dropdownOptionTextSelected : null
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active ? styles.tabButtonActive : null]}
    >
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OptionPill({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.optionPill, active ? styles.optionPillActive : null]}
    >
      <Text style={[styles.optionPillText, active ? styles.optionPillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatNoteTypeLabel(value: MobileChildNote["noteType"]): string {
  return mobileChildNoteTypeOptions.find((option) => option.value === value)?.label ?? "Not";
}

function formatReminderStatusLabel(value: MobileChildReminder["status"]): string {
  const labels: Record<MobileChildReminder["status"], string> = {
    cancelled: "İptal",
    completed: "Tamamlandı",
    paused: "Duraklatıldı",
    scheduled: "Planlı"
  };

  return labels[value];
}

function formatScheduleKindLabel(value: MobileChildReminder["scheduleKind"]): string {
  const labels: Record<MobileChildReminder["scheduleKind"], string> = {
    daily: "Günlük",
    interval: "Tekrarlı",
    one_time: "Tek sefer",
    relative_before_event: "Randevu öncesi",
    weekly: "Haftalık"
  };

  return labels[value];
}

function redactMobileChildMessage(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer [redacted]")
    .replace(/accessToken["':=\s]+[A-Za-z0-9._-]+/giu, "accessToken=[redacted]")
    .replace(/refreshToken["':=\s]+[A-Za-z0-9._-]+/giu, "refreshToken=[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]");
}

const styles = StyleSheet.create({
  headerLink: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  headerLinkText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  heroCard: {
    gap: spacing.md
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft
  },
  avatarText: {
    fontSize: 28
  },
  heroText: {
    flex: 1,
    gap: 4
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  heroDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  statChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    gap: 2
  },
  statValue: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  message: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    padding: spacing.md
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  tabButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  tabButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  tabButtonTextActive: {
    color: colors.primaryDark
  },
  formCard: {
    gap: spacing.md
  },
  listCard: {
    gap: spacing.md
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "700"
  },
  textArea: {
    minHeight: 112
  },
  textAreaSmall: {
    minHeight: 82
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  optionPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 9
  },
  optionPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  optionPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  optionPillTextActive: {
    color: colors.primaryDark
  },
  quickGrid: {
    gap: spacing.sm
  },
  quickCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    gap: 4
  },
  quickTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  quickText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  dropdown: {
    gap: spacing.xs
  },
  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  dropdownButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  dropdownChevron: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  dropdownOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  dropdownOptionSelected: {
    backgroundColor: colors.surfaceSoft
  },
  dropdownOptionText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  dropdownOptionTextSelected: {
    color: colors.primaryDark,
    fontWeight: "900"
  },
  field: {
    gap: spacing.xs
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  twoColumn: {
    gap: spacing.sm
  },
  formActions: {
    gap: spacing.sm
  },
  list: {
    gap: spacing.sm
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    gap: spacing.sm
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  rowText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  rowMeta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  rowActions: {
    gap: spacing.sm
  }
});
