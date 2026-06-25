import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../../ui/theme";
import { Paragraph, Screen } from "../../ui/screen";
import { useAuthSession } from "../auth/auth-session";

export function AccountScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;

  async function handleLogout() {
    await authSession.logout();
    router.replace("/");
  }

  return (
    <Screen
      eyebrow="Hesap"
      title={currentUser ? "Mobil hesabım" : "Hesap gerekli"}
      subtitle={
        currentUser
          ? "Favoriler, mesajlar, ilanlar ve çocuk profili bu alanda toplanacak."
          : "Favoriler, mesajlar ve ilan yönetimi için giriş yap."
      }
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {currentUser?.profile.displayName.slice(0, 1).toUpperCase() ?? "B"}
          </Text>
        </View>

        <View style={styles.profileText}>
          <Text style={styles.profileTitle}>
            {currentUser?.profile.displayName ?? "BabyLoop hesabı"}
          </Text>
          <Text style={styles.profileSubtitle}>
            {currentUser?.user.email ?? "Henüz giriş yapılmadı."}
          </Text>
          {currentUser?.profile.locationCity ? (
            <Text style={styles.profileMeta}>{currentUser.profile.locationCity}</Text>
          ) : null}
        </View>
      </View>

      {authSession.status === "checking" ? (
        <StateCard title="Oturum kontrol ediliyor" text="Mevcut auth cookie/token bilgisi kontrol ediliyor." />
      ) : null}

      {!currentUser ? (
        <View style={styles.authActions}>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            </Pressable>
          </Link>

          <Link href="/register" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Hesap oluştur</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Çıkış yap</Text>
          </Pressable>

          <View style={styles.menu}>
            <MenuItem title="Favorilerim" description="Kaydettiğin ilanlar burada görünecek." />
            <MenuItem title="Mesajlar" description="Satıcı ve alıcı konuşmaları mobilde açılacak." />
            <MenuItem title="İlanlarım" description="Satıştaki ürünlerini yönet." />
            <MenuItem title="Çocuğum" description="Yaşa göre öneriler ve bildirim tercihleri." />
          </View>
        </>
      )}

      <Paragraph>
        Backoffice, admin veya hassas moderasyon verisi mobil public uygulamada gösterilmeyecek.
      </Paragraph>

      <Link href="/" style={styles.link}>
        Keşfe dön
      </Link>
    </Screen>
  );
}

function MenuItem({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.menuItem}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuDescription}>{description}</Text>
    </View>
  );
}

function StateCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    ...shadows.card,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 13
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: colors.cream
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: "900"
  },
  profileText: {
    flex: 1,
    gap: 3
  },
  profileTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  profileSubtitle: {
    color: colors.muted,
    fontSize: 14
  },
  profileMeta: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: "800"
  },
  authActions: {
    gap: 10
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  menu: {
    gap: 10
  },
  menuItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 15,
    gap: 4
  },
  menuTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  menuDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  logoutButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#fff0ed",
    paddingVertical: 14
  },
  logoutButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  stateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6
  },
  stateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
    paddingVertical: 6
  }
});
