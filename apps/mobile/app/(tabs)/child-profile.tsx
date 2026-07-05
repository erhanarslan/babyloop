import { Link, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

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
  type MobileChildNote,
  type MobileChildProfile,
  type MobileChildReminder
} from "../../src/features/child/child-reminders-api";
import {
  getDefaultMobileChildProfilePayload,
  getMobileChildNoteItems,
  getMobileChildReminderItems
} from "../../src/features/child/child-reminders-model";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { MobileButton, MobileCard } from "../../src/ui/mobile-primitives";
import { Screen } from "../../src/ui/screen";
import { colors, radius, spacing } from "../../src/ui/theme";
import {
  appendMobileChildReminder,
  buildMobileChildNoteCreatePayload,
  buildMobileChildReminderCreatePayload,
  canRunMobileChildProfileAction,
  getMobileChildDeliveryBoundaryText,
  getMobileChildMutationMessage,
  getMobileChildProfileMetaLabel,
  getMobileChildRequiredTitleMessage,
  getPreferredMobileChildProfile,
  normalizeMobileChildEntryTitle,
  prependMobileChildNote,
  removeMobileChildNote,
  removeMobileChildReminder,
  replaceMobileChildReminder
} from "../../src/features/child/child-reminder-screen-state-model";

export default function ChildProfileRoute() {
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [childProfile, setChildProfile] = useState<MobileChildProfile | null>(null);
  const [notes, setNotes] = useState<MobileChildNote[]>([]);
  const [reminders, setReminders] = useState<MobileChildReminder[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const noteItems = useMemo(() => getMobileChildNoteItems(notes), [notes]);
  const reminderItems = useMemo(() => getMobileChildReminderItems(reminders), [reminders]);

  const loadChildData = useCallback(async () => {
    if (!currentUser) {
      setChildProfile(null);
      setNotes([]);
      setReminders([]);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const profilesResponse = await fetchMobileChildProfiles();

    if (!profilesResponse.ok) {
      setMessage(profilesResponse.error.message);
      setIsLoading(false);
      return;
    }

    let activeProfile = getPreferredMobileChildProfile(profilesResponse.data.childProfiles);

    if (!activeProfile) {
      const createdProfile = await createMobileChildProfile(getDefaultMobileChildProfilePayload());

      if (!createdProfile.ok) {
        setMessage(createdProfile.error.message);
        setIsLoading(false);
        return;
      }

      activeProfile = createdProfile.data.childProfile;
    }

    setChildProfile(activeProfile);

    const [notesResponse, remindersResponse] = await Promise.all([
      fetchMobileChildNotes(activeProfile.id),
      fetchMobileChildReminders(activeProfile.id)
    ]);

    if (!notesResponse.ok) {
      setMessage(notesResponse.error.message);
    } else {
      setNotes(notesResponse.data.notes);
    }

    if (!remindersResponse.ok) {
      setMessage(remindersResponse.error.message);
    } else {
      setReminders(remindersResponse.data.reminders);
    }

    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    void loadChildData();
  }, [loadChildData]);

  const handleCreateNote = useCallback(async () => {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    const title = normalizeMobileChildEntryTitle(noteTitle);

    if (!title) {
      setMessage(getMobileChildRequiredTitleMessage("note"));
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await createMobileChildNote(childProfile.id, buildMobileChildNoteCreatePayload(title));

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setNotes((current) => prependMobileChildNote(current, response.data.note));
      setNoteTitle("");
      setMessage(getMobileChildMutationMessage("note_created"));
    }

    setIsSubmitting(false);
  }, [childProfile, isSubmitting, noteTitle]);

  const handleArchiveNote = useCallback(async (noteId: string) => {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await archiveMobileChildNote(childProfile.id, noteId);

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setNotes((current) => removeMobileChildNote(current, noteId));
      setMessage(getMobileChildMutationMessage("note_archived"));
    }

    setIsSubmitting(false);
  }, [childProfile, isSubmitting]);

  const handleCreateReminder = useCallback(async () => {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    const title = normalizeMobileChildEntryTitle(reminderTitle);

    if (!title) {
      setMessage(getMobileChildRequiredTitleMessage("reminder"));
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await createMobileChildReminder(childProfile.id, buildMobileChildReminderCreatePayload(title));

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setReminders((current) => appendMobileChildReminder(current, response.data.reminder));
      setReminderTitle("");
      setMessage(getMobileChildMutationMessage("reminder_created"));
    }

    setIsSubmitting(false);
  }, [childProfile, isSubmitting, reminderTitle]);

  const handleCompleteReminder = useCallback(async (reminderId: string) => {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await completeMobileChildReminder(childProfile.id, reminderId);

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setReminders((current) => replaceMobileChildReminder(current, reminderId, response.data.reminder));
      setMessage(getMobileChildMutationMessage("reminder_completed"));
    }

    setIsSubmitting(false);
  }, [childProfile, isSubmitting]);

  const handleCancelReminder = useCallback(async (reminderId: string) => {
    if (!canRunMobileChildProfileAction(childProfile, isSubmitting)) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await cancelMobileChildReminder(childProfile.id, reminderId);

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setReminders((current) => removeMobileChildReminder(current, reminderId));
      setMessage(getMobileChildMutationMessage("reminder_cancelled"));
    }

    setIsSubmitting(false);
  }, [childProfile, isSubmitting]);

  if (!currentUser) {
    return (
      <Screen eyebrow="Çocuğum" title="Giriş gerekli">
        <MobileCard style={styles.heroCard}>
          <Text style={styles.heroTitle}>Çocuk notları hesabına bağlıdır.</Text>
          <Text style={styles.heroText}>Not ve hatırlatıcılarını görmek için giriş yap.</Text>
          <MobileButton onPress={() => router.push("/login")}>Giriş yap</MobileButton>
        </MobileCard>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Çocuğum" title={childProfile?.label ?? "Notlar"}>
      <MobileCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>{childProfile?.label ?? "Çocuğum"}</Text>
        <Text style={styles.heroText}>
          {getMobileChildDeliveryBoundaryText()}
        </Text>
        <View style={styles.sectionHeader}>
          <Text style={styles.metaText}>{getMobileChildProfileMetaLabel(isLoading)}</Text>
          <Link href="/notification-preferences" style={styles.sectionLink}>
            Ayarlar
          </Link>
        </View>
      </MobileCard>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <MobileCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Yeni not</Text>
        <TextInput
          autoCapitalize="sentences"
          editable={!isSubmitting}
          onChangeText={setNoteTitle}
          placeholder="Örn. Bez stoğu azaldı"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={noteTitle}
        />
        <MobileButton onPress={() => void handleCreateNote()}>Not ekle</MobileButton>
      </MobileCard>

      <View style={styles.grid}>
        {noteItems.map((item) => (
          <MobileCard key={item.id ?? item.title} style={styles.noteCard}>
            <Text style={styles.noteTitle}>{item.title}</Text>
            <Text style={styles.noteValue}>{item.value}</Text>
            {item.id ? (
              <MobileButton onPress={() => void handleArchiveNote(item.id!)} variant="ghost">
                Arşivle
              </MobileButton>
            ) : null}
          </MobileCard>
        ))}
      </View>

      <MobileCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Yeni hatırlatıcı</Text>
        <TextInput
          autoCapitalize="sentences"
          editable={!isSubmitting}
          onChangeText={setReminderTitle}
          placeholder="Örn. Yarın bez al"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={reminderTitle}
        />
        <MobileButton onPress={() => void handleCreateReminder()}>Yarın 10:00 için ekle</MobileButton>
      </MobileCard>

      <MobileCard style={styles.reminderCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yaklaşanlar</Text>
          <Text style={styles.metaText}>{reminderItems.length} kayıt</Text>
        </View>

        <View style={styles.reminderList}>
          {reminderItems.map((item) => (
            <View key={item.id ?? item.title} style={styles.reminderRow}>
              <View style={styles.dot} />
              <View style={styles.reminderContent}>
                <Text style={styles.reminderText}>{item.title}</Text>
                <Text style={styles.noteValue}>{item.value}</Text>
                {item.id ? (
                  <View style={styles.actionRow}>
                    <MobileButton onPress={() => void handleCompleteReminder(item.id!)} variant="secondary">
                      Tamamla
                    </MobileButton>
                    <MobileButton onPress={() => void handleCancelReminder(item.id!)} variant="ghost">
                      İptal
                    </MobileButton>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </MobileCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  metaText: {
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
    padding: spacing.md
  },
  formCard: {
    gap: spacing.sm
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  noteCard: {
    width: "48%",
    minHeight: 116,
    gap: spacing.xs
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  noteValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  reminderCard: {
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  sectionLink: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  reminderList: {
    gap: spacing.sm
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md
  },
  reminderContent: {
    flex: 1,
    gap: spacing.xs
  },
  dot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  reminderText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs
  }
});
