import { Link, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  fetchMobileChildProfiles,
  updateMobileChildProfile,
  type MobileChildProfile,
  type MobileChildProfileNotificationCadence
} from "../../src/features/child/child-reminders-api";
import {
  formatCadence,
  getMobileChildReminderSettings
} from "../../src/features/child/child-reminders-model";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { MobileButton, MobileCard } from "../../src/ui/mobile-primitives";
import { Screen } from "../../src/ui/screen";
import { colors, radius, spacing } from "../../src/ui/theme";

const cadenceOptions: Array<{
  cadence: MobileChildProfileNotificationCadence;
  title: string;
  description: string;
}> = [
  {
    cadence: "monthly",
    title: "Aylık",
    description: "Çocuğun yaş dönemine göre pratik ürün ihtiyacı taslakları."
  },
  {
    cadence: "yearly",
    title: "Yıllık",
    description: "Daha seyrek, büyük dönem geçişleri için öneri taslakları."
  },
  {
    cadence: "off",
    title: "Kapalı",
    description: "Çocuk profili öneri bildirimlerini durdurur."
  }
];

export default function NotificationPreferencesRoute() {
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [childProfile, setChildProfile] = useState<MobileChildProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const reminderSettings = useMemo(
    () => getMobileChildReminderSettings(childProfile),
    [childProfile]
  );

  const loadChildProfile = useCallback(async () => {
    if (!currentUser) {
      setChildProfile(null);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const response = await fetchMobileChildProfiles();

    if (!response.ok) {
      setMessage(response.error.message);
      setIsLoading(false);
      return;
    }

    setChildProfile(
      response.data.childProfiles.find((profile) => profile.isActive)
        ?? response.data.childProfiles[0]
        ?? null
    );
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    void loadChildProfile();
  }, [loadChildProfile]);

  const handleCadenceUpdate = useCallback(async (cadence: MobileChildProfileNotificationCadence) => {
    if (!childProfile || isUpdating) {
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    const response = await updateMobileChildProfile(childProfile.id, {
      notificationCadence: cadence
    });

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setChildProfile(response.data.childProfile);
      setMessage(`Bildirim sıklığı ${formatCadence(cadence).toLowerCase()} olarak güncellendi.`);
    }

    setIsUpdating(false);
  }, [childProfile, isUpdating]);

  if (!currentUser) {
    return (
      <Screen eyebrow="Bildirimler" title="Giriş gerekli">
        <MobileCard style={styles.heroCard}>
          <Text style={styles.heroTitle}>Bildirim tercihleri hesabına bağlıdır.</Text>
          <Text style={styles.heroText}>Çocuk notları ve öneri taslakları için giriş yap.</Text>
          <MobileButton onPress={() => router.push("/login")}>Giriş yap</MobileButton>
        </MobileCard>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Bildirimler" title="Hatırlatıcılar">
      <MobileCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>Çocuk notları için bildirimler</Text>
        <Text style={styles.heroText}>
          Bu ekran gerçek push gönderimi yapmaz; çocuk profili öneri sıklığını ve uygulama içi hatırlatıcı durumunu yönetir.
        </Text>
        <Text style={styles.metaText}>
          {isLoading ? "Yükleniyor..." : childProfile ? `Aktif profil: ${childProfile.label}` : "Aktif çocuk profili yok"}
        </Text>
      </MobileCard>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.list}>
        {reminderSettings.map((item) => (
          <MobileCard key={item.title} style={styles.settingCard}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{item.title}</Text>
              <Text style={styles.settingValue}>{item.value}</Text>
            </View>
            <Text style={[styles.status, item.status === "disabled" ? styles.statusDisabled : null]}>
              {item.status === "active" ? "Aktif" : item.status === "draft" ? "Taslak" : "Kapalı"}
            </Text>
          </MobileCard>
        ))}
      </View>

      <MobileCard style={styles.heroCard}>
        <Text style={styles.sectionTitle}>Öneri sıklığı</Text>
        {cadenceOptions.map((option) => (
          <View key={option.cadence} style={styles.cadenceRow}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{option.title}</Text>
              <Text style={styles.settingValue}>{option.description}</Text>
            </View>
            <MobileButton
              onPress={() => void handleCadenceUpdate(option.cadence)}
              variant={childProfile?.notificationCadence === option.cadence ? "secondary" : "ghost"}
            >
              Seç
            </MobileButton>
          </View>
        ))}
      </MobileCard>

      <Link href="/child-profile" style={styles.link}>
        Çocuğum notlarına dön
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.sm
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3
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
  list: {
    gap: spacing.sm
  },
  settingCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  settingContent: {
    flex: 1,
    gap: 3
  },
  settingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  settingValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  status: {
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusDisabled: {
    backgroundColor: colors.surfaceSoft,
    color: colors.muted
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  cadenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md
  },
  link: {
    alignSelf: "center",
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
    paddingVertical: 8
  }
});
