import { Link, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import {
  fetchMobileChildProfiles,
  updateMobileChildProfile,
  type MobileChildProfile,
  type MobileChildProfileNotificationCadence
} from "../../src/features/child/child-reminders-api";
import { getMobileChildReminderSettings } from "../../src/features/child/child-reminders-model";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { MobileButton, MobileCard } from "../../src/ui/mobile-primitives";
import { Screen } from "../../src/ui/screen";
import { colors, radius, spacing } from "../../src/ui/theme";
import {
  canUpdateMobileNotificationCadence,
  getMobileNotificationCadenceUpdateMessage,
  getMobileNotificationPreferenceDeliveryBoundaryText,
  getMobileNotificationPreferenceProfileLabel,
  getPreferredMobileNotificationChildProfile,
  isMobileNotificationCadenceSelected,
  canUseMobileNotificationProviderDelivery,
  findMobileMarketplaceEmailPreference,
  mobileMarketplaceEmailPreferenceDefinitions,
  mobileNotificationPreferenceCadenceOptions,
  replaceMobileNotificationPreference,
  type MobileMarketplaceEmailPreferenceSource
} from "../../src/features/notifications/notification-preferences-model";
import {
  fetchMobileNotificationPreferences,
  updateMobileNotificationPreference,
  type MobileNotificationPreferencesPayload
} from "../../src/features/notifications/notifications-api";

export default function NotificationPreferencesRoute() {
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [childProfile, setChildProfile] = useState<MobileChildProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<MobileNotificationPreferencesPayload | null>(null);
  const [updatingEmailSource, setUpdatingEmailSource] = useState<MobileMarketplaceEmailPreferenceSource | null>(null);

  const reminderSettings = useMemo(
    () => getMobileChildReminderSettings(childProfile),
    [childProfile]
  );

  const loadChildProfile = useCallback(async () => {
    if (!currentUser) {
      setChildProfile(null);
      setNotificationPreferences(null);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const [response, preferencesResponse] = await Promise.all([
      fetchMobileChildProfiles(),
      fetchMobileNotificationPreferences()
    ]);

    setChildProfile(response.ok
      ? getPreferredMobileNotificationChildProfile(response.data.childProfiles)
      : null);
    setNotificationPreferences(preferencesResponse.ok ? preferencesResponse.data : null);
    if (!response.ok) {
      setMessage(response.error.message);
    }
    if (!preferencesResponse.ok) {
      setMessage(preferencesResponse.error.message);
    }
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    void loadChildProfile();
  }, [loadChildProfile]);

  const handleCadenceUpdate = useCallback(async (cadence: MobileChildProfileNotificationCadence) => {
    if (!canUpdateMobileNotificationCadence(childProfile, isUpdating)) {
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
      setMessage(getMobileNotificationCadenceUpdateMessage(cadence));
    }

    setIsUpdating(false);
  }, [childProfile, isUpdating]);

  const handleEmailPreferenceUpdate = useCallback(async (
    source: MobileMarketplaceEmailPreferenceSource,
    enabled: boolean
  ) => {
    setUpdatingEmailSource(source);
    setMessage(null);
    const currentPreference = findMobileMarketplaceEmailPreference(notificationPreferences, source);

    const response = await updateMobileNotificationPreference({
      source,
      channel: "email",
      enabled,
      mutedUntil: currentPreference?.mutedUntil ?? null,
      quietHoursStart: currentPreference?.quietHoursStart ?? null,
      quietHoursEnd: currentPreference?.quietHoursEnd ?? null,
      timezone: currentPreference?.timezone ?? "Europe/Istanbul",
      digest: currentPreference?.digest ?? "immediate"
    });

    if (!response.ok) {
      setMessage(response.error.message);
    } else {
      setNotificationPreferences((current) => current ? {
        ...replaceMobileNotificationPreference(current, response.data.preference),
        recentAuditEvents: [response.data.auditEvent, ...current.recentAuditEvents].slice(0, 20),
        summary: response.data.summary
      } : current);
      setMessage(enabled ? "E-posta bildirimi açıldı." : "E-posta bildirimi kapatıldı.");
    }

    setUpdatingEmailSource(null);
  }, [notificationPreferences]);

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
    <Screen eyebrow="Bildirimler" title="Bildirim tercihleri">
      <MobileCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>Çocuk notları için bildirimler</Text>
        <Text style={styles.heroText}>
          {getMobileNotificationPreferenceDeliveryBoundaryText()}
        </Text>
        <Text style={styles.metaText}>
          {getMobileNotificationPreferenceProfileLabel({ isLoading, childProfile })}
        </Text>
      </MobileCard>

      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}

      <MobileCard style={styles.heroCard}>
        <View style={styles.providerHeader}>
          <View style={styles.settingContent}>
            <Text style={styles.sectionTitle}>E-posta bildirimleri</Text>
            <Text style={styles.settingValue}>
              {canUseMobileNotificationProviderDelivery(notificationPreferences)
                ? "E-posta gönderimi sunucuda etkin."
                : "Tercihlerin kaydedilir; gönderim için sunucuda e-posta sağlayıcısı etkin olmalıdır."}
            </Text>
          </View>
          <Text style={[
            styles.status,
            !canUseMobileNotificationProviderDelivery(notificationPreferences) ? styles.statusDisabled : null
          ]}>
            {canUseMobileNotificationProviderDelivery(notificationPreferences) ? "Aktif" : "Bekliyor"}
          </Text>
        </View>
        {mobileMarketplaceEmailPreferenceDefinitions.map((definition) => {
          const preference = findMobileMarketplaceEmailPreference(notificationPreferences, definition.source);
          const enabled = preference?.enabled ?? false;

          return (
            <View key={definition.source} style={styles.emailPreferenceRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{definition.title}</Text>
                <Text style={styles.settingValue}>{definition.description}</Text>
              </View>
              <Switch
                accessibilityLabel={definition.title}
                disabled={isLoading || updatingEmailSource !== null}
                onValueChange={(value) => void handleEmailPreferenceUpdate(definition.source, value)}
                trackColor={{ false: colors.border, true: colors.peach }}
                thumbColor={enabled ? colors.primary : colors.muted}
                value={enabled}
              />
            </View>
          );
        })}
      </MobileCard>

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
        {mobileNotificationPreferenceCadenceOptions.map((option) => (
          <View key={option.cadence} style={styles.cadenceRow}>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{option.title}</Text>
              <Text style={styles.settingValue}>{option.description}</Text>
            </View>
            <MobileButton
              onPress={() => void handleCadenceUpdate(option.cadence)}
              disabled={!canUpdateMobileNotificationCadence(childProfile, isUpdating)}
              variant={isMobileNotificationCadenceSelected(childProfile, option.cadence) ? "secondary" : "ghost"}
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
  providerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  emailPreferenceRow: {
    minHeight: 76,
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
