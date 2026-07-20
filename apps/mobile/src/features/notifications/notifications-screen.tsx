import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileNotificationPreferences,
  fetchMobileNotifications,
  generateMobileChildLifecycleNotifications,
  markAllMobileNotificationsRead,
  markMobileNotificationRead,
  updateMobileNotificationPreference,
  type MobileNotificationPreferencesPayload,
  type MobileNotification
} from "./notifications-api";
import {
  getMobileNotificationCards,
  getMobileUnreadNotificationCountLabel
} from "./notifications-model";
import {
  canUseMobileNotificationProviderDelivery,
  getMobileNotificationPreferenceChannelSummary
} from "./notification-preferences-model";
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import { Screen } from "../../ui/screen";
import { colors, radius, spacing } from "../../ui/theme";

export function NotificationsScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [preferencesPayload, setPreferencesPayload] =
    useState<MobileNotificationPreferencesPayload | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isPreferenceUpdating, setIsPreferenceUpdating] = useState(false);

  const notificationCards = useMemo(
    () => getMobileNotificationCards(notifications),
    [notifications]
  );

  const loadNotifications = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!currentUser) {
      setNotifications([]);
      setPreferencesPayload(null);
      setUnreadCount(0);
      setStatus("ready");
      setError(null);
      return;
    }

    if (!options.silent) {
      setStatus("loading");
    }

    setError(null);

    const notificationsResponse = await fetchMobileNotifications();

    if (!notificationsResponse.ok) {
      setStatus("error");
      setError(notificationsResponse.error.message);
      return;
    }

    setNotifications(notificationsResponse.data.notifications);
    setUnreadCount(notificationsResponse.data.unreadCount);
    setStatus("ready");
  }, [currentUser]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      if (!currentUser) {
        setPreferencesPayload(null);
        return;
      }

      const response = await fetchMobileNotificationPreferences();

      if (active) {
        setPreferencesPayload(response.ok ? response.data : null);
      }
    }

    void loadPreferences();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const handleNotificationPress = useCallback(async (notification: MobileNotification) => {
    if (isMutating) {
      return;
    }

    if (notification.readAt === null) {
      setIsMutating(true);

      const response = await markMobileNotificationRead(notification.id);

      if (!response.ok) {
        setMessage(response.error.message);
        setIsMutating(false);
        return;
      }

      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? response.data.notification : item)
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      setIsMutating(false);
    }

    openNotificationTarget(notification);
  }, [isMutating]);

  const handleReadAll = useCallback(async () => {
    if (isMutating || unreadCount === 0) {
      return;
    }

    setIsMutating(true);
    setMessage(null);

    const response = await markAllMobileNotificationsRead();

    if (!response.ok) {
      setMessage(response.error.message);
      setIsMutating(false);
      return;
    }

    const readAt = new Date().toISOString();

    setNotifications((current) => current.map((notification) => ({
      ...notification,
      readAt: notification.readAt ?? readAt
    })));
    setUnreadCount(0);
    setMessage(`${response.data.updatedCount} bildirim okundu olarak işaretlendi.`);
    setIsMutating(false);
  }, [isMutating, unreadCount]);

  const handleGenerateChildLifecycle = useCallback(async () => {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setMessage(null);

    const response = await generateMobileChildLifecycleNotifications();

    if (!response.ok) {
      setMessage(response.error.message);
      setIsMutating(false);
      return;
    }

    setMessage(
      response.data.createdCount > 0
        ? `${response.data.createdCount} çocuk önerisi bildirimi oluşturuldu.`
        : "Yeni çocuk önerisi bildirimi yok."
    );
    await loadNotifications({ silent: true });
    setIsMutating(false);
  }, [isMutating, loadNotifications]);

  const messagesInAppPreference = useMemo(
    () => preferencesPayload?.preferences.find((preference) =>
      preference.source === "messages" && preference.channel === "in_app"
    ) ?? null,
    [preferencesPayload]
  );

  const handleToggleMessagesInAppPreference = useCallback(async () => {
    if (isPreferenceUpdating || !messagesInAppPreference) {
      return;
    }

    setIsPreferenceUpdating(true);
    setMessage(null);

    const response = await updateMobileNotificationPreference({
      channel: "in_app",
      enabled: !messagesInAppPreference.enabled,
      reason: "mobile_notifications_screen",
      source: "messages"
    });

    if (!response.ok) {
      setMessage(response.error.message);
      setIsPreferenceUpdating(false);
      return;
    }

    setPreferencesPayload((current) => {
      if (!current) {
        return current;
      }

      return {
        preferences: current.preferences.map((preference) =>
          preference.source === "messages" && preference.channel === "in_app"
            ? response.data.preference
            : preference
        ),
        recentAuditEvents: [
          response.data.auditEvent,
          ...current.recentAuditEvents
        ].slice(0, 20),
        summary: response.data.summary
      };
    });
    setMessage(
      response.data.preference.enabled
        ? "Mesajlar için uygulama içi bildirimler açıldı."
        : "Mesajlar için uygulama içi bildirimler kapatıldı."
    );
    setIsPreferenceUpdating(false);
  }, [isPreferenceUpdating, messagesInAppPreference]);

  function openNotificationTarget(notification: MobileNotification): void {
    if (notification.entityType === "conversation" && notification.entityId) {
      router.push(`/conversation/${encodeURIComponent(notification.entityId)}`);
      return;
    }

    if (notification.entityType === "listing" && notification.entityId) {
      router.push(`/listing/${encodeURIComponent(notification.entityId)}`);
      return;
    }

    if (notification.entityType === "child_profile") {
      router.push("/child-profile");
    }
  }

  if (!currentUser) {
    return (
      <Screen
        eyebrow="Bildirimler"
        title="Giriş gerekli"
        subtitle="Mesaj, favori ve çocuk önerisi bildirimleri hesabına bağlıdır."
      >
        <MobileCard style={styles.stateStack}>
          <Text style={styles.stateTitle}>Hesabına giriş yap</Text>
          <Text style={styles.stateText}>Bildirimlerini görmek ve okundu durumunu yönetmek için giriş yap.</Text>
          <MobileButton onPress={() => router.push("/login")}>Giriş yap</MobileButton>
        </MobileCard>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Bildirimler"
      title="Bildirimler"
      subtitle={getMobileUnreadNotificationCountLabel(unreadCount)}
    >
      <MobileCard style={styles.summaryCard}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryTitle}>Uygulama içi bildirimler</Text>
          <Text style={styles.summaryText}>
            Mesaj, favori ve çocuk profili önerilerini burada takip edebilirsin.
          </Text>
        </View>

        <View style={styles.summaryActions}>
          <MobileButton
            disabled={isMutating || unreadCount === 0}
            onPress={() => void handleReadAll()}
            variant="secondary"
          >
            Tümünü okundu yap
          </MobileButton>
          <MobileButton
            disabled={isMutating}
            onPress={() => void handleGenerateChildLifecycle()}
            variant="ghost"
          >
            Çocuk önerilerini yenile
          </MobileButton>
        </View>
      </MobileCard>

      <MobileCard style={styles.preferenceCard}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryTitle}>Bildirim tercihleri</Text>
          <Text style={styles.summaryText}>
            {getMobileNotificationPreferenceChannelSummary(preferencesPayload)}
          </Text>
          {!canUseMobileNotificationProviderDelivery(preferencesPayload) ? (
            <Text style={styles.preferenceBoundaryText}>
              Email, push ve n8n gönderimi sunucu provider ayarları, cihaz izni ve tercih durumuna bağlıdır.
            </Text>
          ) : null}
        </View>
        <MobileButton
          disabled={!messagesInAppPreference || isPreferenceUpdating}
          onPress={() => void handleToggleMessagesInAppPreference()}
          variant="secondary"
        >
          {messagesInAppPreference?.enabled ? "Mesaj bildirimlerini kapat" : "Mesaj bildirimlerini aç"}
        </MobileButton>
      </MobileCard>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {status === "loading" ? <MobileSkeleton label="Bildirimler yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadNotifications()}
          title="Bildirimler yüklenemedi"
        />
      ) : null}

      {status === "ready" && notificationCards.length === 0 ? (
        <MobileEmptyState
          actionLabel="Çocuk önerilerini yenile"
          message="Mesaj, favori veya çocuk önerisi bildirimin geldiğinde burada görünür."
          onAction={() => void handleGenerateChildLifecycle()}
          title="Henüz bildirim yok"
        />
      ) : null}

      <View style={styles.list}>
        {notificationCards.map((card) => {
          const notification = notifications.find((item) => item.id === card.id);

          if (!notification) {
            return null;
          }

          return (
            <Pressable
              accessibilityRole="button"
              disabled={isMutating}
              key={card.id}
              onPress={() => void handleNotificationPress(notification)}
              style={[
                styles.notificationCard,
                card.unread ? styles.notificationCardUnread : null
              ]}
            >
              <View style={styles.notificationHeader}>
                <View style={styles.notificationTitleBlock}>
                  <Text numberOfLines={2} style={styles.notificationTitle}>
                    {card.title}
                  </Text>
                  <Text style={styles.notificationMeta}>{card.meta}</Text>
                </View>

                {card.unread ? (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadDotText}>Yeni</Text>
                  </View>
                ) : null}
              </View>

              <Text numberOfLines={3} style={styles.notificationBody}>
                {card.body}
              </Text>

              {card.actionLabel ? (
                <Text style={styles.actionLabel}>{card.actionLabel}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateStack: {
    gap: spacing.sm
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  summaryCard: {
    gap: spacing.md
  },
  summaryTextBlock: {
    gap: spacing.xs
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  summaryText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  summaryActions: {
    gap: spacing.sm
  },
  preferenceCard: {
    gap: spacing.md
  },
  preferenceBoundaryText: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
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
  notificationCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm
  },
  notificationCardUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  notificationTitleBlock: {
    flex: 1,
    gap: 4
  },
  notificationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  notificationMeta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  notificationBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  unreadDot: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  unreadDotText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: "900"
  },
  actionLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  }
});
