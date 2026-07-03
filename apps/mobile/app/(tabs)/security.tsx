import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/auth-session";
import {
  disableMobileMfa,
  enableMobileMfa,
  fetchMobileMfaStatus
} from "../../src/features/auth/auth-api";
import {
  getMobileSecurityRows,
  type MobileSecurityRowTone
} from "../../src/features/security/security-model";
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

  useEffect(() => {
    if (!currentUser) {
      setMfaEnabled(null);
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

    void loadMfaStatus();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const securityRows = useMemo(
    () => getMobileSecurityRows({ mfaEnabled }),
    [mfaEnabled]
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
              ? "Kaydediliyor..."
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
        <Text style={styles.title}>Çıkış</Text>
        <Text style={styles.text}>Bu cihazdaki mobil oturumu kapatır.</Text>
        <MobileButton iconName="log-out-outline" onPress={() => void handleLogout()} variant="danger">
          Çıkış yap
        </MobileButton>
      </MobileCard>
    </Screen>
  );
}

function SecurityRow({
  badge,
  title,
  value,
  tone = "neutral"
}: {
  badge: string;
  title: string;
  value: string;
  tone?: MobileSecurityRowTone;
}) {
  return (
    <MobileCard style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <Text
        style={[
          styles.status,
          tone === "success" ? styles.statusSuccess : null,
          tone === "pending" ? styles.statusPending : null
        ]}
      >
        {badge}
      </Text>
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    gap: spacing.xs
  },
  card: {
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  meta: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  list: {
    gap: spacing.sm
  },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  rowText: {
    flex: 1,
    gap: 3
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  rowValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  status: {
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  statusSuccess: {
    backgroundColor: colors.successSoft,
    color: colors.success
  },
  statusPending: {
    backgroundColor: colors.warningSoft,
    color: colors.warning
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13
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
  }
});
