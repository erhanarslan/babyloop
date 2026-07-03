import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/auth-session";
import {
  disableMobileMfa,
  enableMobileMfa,
  fetchMobileAuthSessions,
  fetchMobileMfaStatus,
  revokeAllMobileAuthSessions,
  revokeMobileAuthSession,
  type MobileAuthSession
} from "../../src/features/auth/auth-api";
import {
  getMobileSecurityRows,
  type MobileSecurityRowTone
} from "../../src/features/security/security-model";
import {
  buildMobileSessionCards,
  getMobileSessionSummary
} from "../../src/features/security/mobile-session-model";
import { MobileButton, MobileCard } from "../../src/ui/mobile-primitives";
import { Screen } from "../../src/ui/screen";
import { colors, radius, spacing } from "../../src/ui/theme";

export default function SecurityRoute() {
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [loadingMfaStatus, setLoadingMfaStatus] = useState(false);
  const [savingMfa, setSavingMfa] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<MobileAuthSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAllSessions, setRevokingAllSessions] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setMfaEnabled(null);
      setSessions([]);
      setCurrentSessionId(null);
      return;
    }

    let cancelled = false;

    async function loadMfaStatus() {
      setLoadingMfaStatus(true);
      setMfaError(null);

      const response = await fetchMobileMfaStatus();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setMfaEnabled(response.data.mfaEnabled);
      } else {
        setMfaEnabled(null);
        setMfaError(response.error.message);
      }

      setLoadingMfaStatus(false);
    }

    async function loadSessions() {
      setLoadingSessions(true);
      setSessionError(null);

      const response = await fetchMobileAuthSessions();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setSessions(response.data.sessions);
        setCurrentSessionId(response.data.currentSessionId);
      } else {
        setSessions([]);
        setCurrentSessionId(null);
        setSessionError(response.error.message);
      }

      setLoadingSessions(false);
    }

    void loadMfaStatus();
    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const securityRows = useMemo(
    () => getMobileSecurityRows({ mfaEnabled }),
    [mfaEnabled]
  );
  const sessionCards = useMemo(
    () => buildMobileSessionCards(sessions, currentSessionId),
    [sessions, currentSessionId]
  );
  const sessionSummary = useMemo(
    () => getMobileSessionSummary(sessions, currentSessionId),
    [sessions, currentSessionId]
  );

  async function handleLogout() {
    await authSession.logout();
    router.replace("/");
  }

  async function handleMfaToggle(nextEnabled: boolean) {
    if (!currentPassword.trim()) {
      setMfaMessage(null);
      setMfaError("MFA ayarını değiştirmek için mevcut şifreni gir.");
      return;
    }

    setSavingMfa(true);
    setMfaMessage(null);
    setMfaError(null);

    try {
      const response = nextEnabled
        ? await enableMobileMfa({ currentPassword })
        : await disableMobileMfa({ currentPassword });

      if (!response.ok) {
        setMfaError(response.error.message);
        return;
      }

      setMfaEnabled(response.data.mfaEnabled);
      setCurrentPassword("");
      setMfaMessage(
        response.data.mfaEnabled
          ? "OTP/MFA aktif. Bir sonraki girişte e-posta kodu istenecek."
          : "OTP/MFA kapatıldı. Bir sonraki girişte ek kod istenmeyecek."
      );
    } finally {
      setSavingMfa(false);
    }
  }

  async function handleSessionRefresh() {
    setLoadingSessions(true);
    setSessionError(null);
    setSessionMessage(null);

    const response = await fetchMobileAuthSessions();

    if (response.ok) {
      setSessions(response.data.sessions);
      setCurrentSessionId(response.data.currentSessionId);
    } else {
      setSessions([]);
      setCurrentSessionId(null);
      setSessionError(response.error.message);
    }

    setLoadingSessions(false);
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingSessionId(sessionId);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const response = await revokeMobileAuthSession(sessionId);

      if (!response.ok) {
        setSessionError(response.error.message);
        return;
      }

      if (response.data.currentSessionRevoked) {
        await authSession.logout();
        router.replace("/login");
        return;
      }

      setSessions((current) => current.filter((session) => session.id !== response.data.sessionId));
      setSessionMessage("Seçili oturum kapatıldı.");
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function handleRevokeAllSessions() {
    setRevokingAllSessions(true);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const response = await revokeAllMobileAuthSessions();

      if (!response.ok) {
        setSessionError(response.error.message);
        return;
      }

      setSessions([]);
      setCurrentSessionId(null);
      await authSession.logout();
      router.replace("/login");
    } finally {
      setRevokingAllSessions(false);
    }
  }

  if (!currentUser) {
    return (
      <Screen eyebrow="Hesap" title="Güvenlik">
        <MobileCard style={styles.card}>
          <Text style={styles.title}>Giriş gerekli</Text>
          <Text style={styles.text}>Şifre ve oturum güvenliği ayarları hesabına bağlıdır.</Text>
          <MobileButton onPress={() => router.push("/login")}>Giriş yap</MobileButton>
        </MobileCard>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Hesap" title="Güvenlik">
      <MobileCard style={styles.profileCard}>
        <Text style={styles.eyebrow}>Aktif oturum</Text>
        <Text style={styles.title}>{currentUser.profile.displayName}</Text>
        <Text style={styles.text}>{currentUser.user.email}</Text>
        {currentUser.profile.locationCity ? (
          <Text style={styles.meta}>{currentUser.profile.locationCity}</Text>
        ) : null}
      </MobileCard>

      <View style={styles.list}>
        {securityRows.map((row) => (
          <SecurityRow
            badge={row.badge}
            key={row.title}
            title={row.title}
            tone={row.tone}
            value={row.value}
          />
        ))}
      </View>

      <MobileCard style={styles.card}>
        <Text style={styles.title}>OTP / MFA</Text>
        <Text style={styles.text}>
          E-posta OTP aktif olduğunda girişten sonra 6 haneli kod doğrulaması gerekir.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setCurrentPassword}
          placeholder="Mevcut şifre"
          placeholderTextColor={colors.subtle}
          secureTextEntry
          style={styles.input}
          value={currentPassword}
        />
        <Pressable
          disabled={savingMfa || loadingMfaStatus}
          onPress={() => void handleMfaToggle(!(mfaEnabled === true))}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed || savingMfa || loadingMfaStatus ? styles.pressed : null
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {savingMfa
              ? "Güncelleniyor..."
              : mfaEnabled === true
                ? "OTP/MFA kapat"
                : "OTP/MFA aç"}
          </Text>
        </Pressable>
        {mfaMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{mfaMessage}</Text>
          </View>
        ) : null}
        {mfaError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{mfaError}</Text>
          </View>
        ) : null}
      </MobileCard>

      <MobileCard style={styles.card}>
        <Text style={styles.title}>Aktif cihazlar</Text>
        <Text style={styles.text}>
          {sessionSummary.activeCountLabel} · {sessionSummary.currentDeviceLabel}
        </Text>
        <Text style={styles.meta}>
          Oturum tokenları, refresh token hashleri ve şifre bilgileri bu ekranda gösterilmez.
        </Text>

        {loadingSessions ? <Text style={styles.text}>Oturumlar yükleniyor...</Text> : null}

        {sessionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{sessionError}</Text>
          </View>
        ) : null}

        {sessionMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{sessionMessage}</Text>
          </View>
        ) : null}

        {!loadingSessions && sessionCards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aktif oturum görünmüyor</Text>
            <Text style={styles.text}>Yeniden giriş yaptığında bu cihaz burada listelenir.</Text>
          </View>
        ) : null}

        <View style={styles.sessionList}>
          {sessionCards.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                {session.isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Bu cihaz</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.sessionSubtitle}>{session.subtitle}</Text>
              <Text style={styles.sessionMeta}>{session.meta}</Text>
              <Pressable
                disabled={revokingSessionId === session.id || revokingAllSessions}
                onPress={() => void handleRevokeSession(session.id)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed || revokingSessionId === session.id || revokingAllSessions ? styles.pressed : null
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {revokingSessionId === session.id ? "Kapatılıyor..." : session.actionLabel}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.sessionActions}>
          <Pressable
            disabled={loadingSessions || revokingAllSessions}
            onPress={() => void handleSessionRefresh()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed || loadingSessions ? styles.pressed : null
            ]}
          >
            <Text style={styles.secondaryButtonText}>Oturumları yenile</Text>
          </Pressable>

          <Pressable
            disabled={revokingAllSessions || sessions.length === 0}
            onPress={() => void handleRevokeAllSessions()}
            style={({ pressed }) => [
              styles.dangerButton,
              pressed || revokingAllSessions || sessions.length === 0 ? styles.pressed : null
            ]}
          >
            <Text style={styles.dangerButtonText}>
              {revokingAllSessions ? "Çıkış yapılıyor..." : "Tüm cihazlardan çıkış yap"}
            </Text>
          </Pressable>
        </View>
      </MobileCard>

      <MobileCard style={styles.card}>
        <Text style={styles.title}>Çıkış</Text>
        <Text style={styles.text}>Bu cihazdaki mobil oturumu kapatır.</Text>
        <MobileButton iconName="log-out-outline" onPress={() => void handleLogout()} variant="danger">
          Bu cihazdan çıkış yap
        </MobileButton>
      </MobileCard>
    </Screen>
  );
}

function SecurityRow({
  badge,
  title,
  tone,
  value
}: {
  badge: string;
  title: string;
  tone: MobileSecurityRowTone;
  value: string;
}) {
  return (
    <MobileCard style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{title}</Text>
        <View style={[styles.badge, getBadgeStyle(tone)]}>
          <Text style={[styles.badgeText, getBadgeTextStyle(tone)]}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.rowText}>{value}</Text>
    </MobileCard>
  );
}

function getBadgeStyle(tone: MobileSecurityRowTone) {
  if (tone === "success") {
    return styles.badgeSuccess;
  }

  if (tone === "pending") {
    return styles.badgePending;
  }

  return styles.badgeNeutral;
}

function getBadgeTextStyle(tone: MobileSecurityRowTone) {
  if (tone === "success") {
    return styles.badgeSuccessText;
  }

  if (tone === "pending") {
    return styles.badgePendingText;
  }

  return styles.badgeNeutralText;
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md
  },
  card: {
    gap: spacing.md
  },
  profileCard: {
    gap: spacing.sm,
    backgroundColor: colors.cream
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  meta: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: "700"
  },
  row: {
    gap: spacing.sm
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  rowTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  rowText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900"
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft
  },
  badgeSuccessText: {
    color: colors.success
  },
  badgeWarning: {
    backgroundColor: colors.warningSoft
  },
  badgeWarningText: {
    color: colors.warning
  },
  badgePending: {
    backgroundColor: colors.surfaceSoft
  },
  badgePendingText: {
    color: colors.primaryDark
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceSoft
  },
  badgeNeutralText: {
    color: colors.muted
  },
  input: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  dangerButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  dangerButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.75
  },
  successBox: {
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    padding: 12
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  errorBox: {
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    padding: 12
  },
  errorText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  emptyBox: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  sessionList: {
    gap: spacing.md
  },
  sessionCard: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  sessionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  sessionTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  sessionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  sessionMeta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  currentBadge: {
    borderRadius: 999,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  currentBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "900"
  },
  sessionActions: {
    gap: spacing.sm
  }
});
