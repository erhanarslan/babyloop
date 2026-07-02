import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useAuthSession } from "../src/features/auth/auth-session";
import { MobileButton, MobileCard } from "../src/ui/mobile-primitives";
import { Screen } from "../src/ui/screen";
import { colors, radius, spacing } from "../src/ui/theme";

export default function SecurityRoute() {
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;

  async function handleLogout() {
    await authSession.logout();
    router.replace("/");
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
        <SecurityRow title="Oturum" value="Açık" tone="success" />
        <SecurityRow title="Şifre" value="Hesap şifresiyle giriş yapıldı" />
        <SecurityRow title="OTP / MFA" value="Bağlanacak" tone="pending" />
        <SecurityRow title="Mobil onay" value="Bağlanacak" tone="pending" />
      </View>

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
  title,
  value,
  tone = "neutral"
}: {
  title: string;
  value: string;
  tone?: "neutral" | "success" | "pending";
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
        {tone === "success" ? "Aktif" : tone === "pending" ? "P1" : "Bilgi"}
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
  }
});
