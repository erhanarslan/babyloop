import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../../ui/theme";
import { Screen } from "../../ui/screen";
import { useAuthSession } from "../auth/auth-session";

const accountShortcuts = [
  {
    href: "/favorites",
    title: "Favorilerim",
    description: "Kaydettiğin ilanları tekrar aç."
  },
  {
    href: "/messages",
    title: "Mesajlarım",
    description: "Alıcı ve satıcı konuşmalarını takip et."
  },
  {
    href: "/sell",
    title: "İlan Ver",
    description: "Satmak istediğin ürünü hazırlamaya başla."
  },
  {
    href: "/child-profile",
    title: "Çocuğum",
    description: "Temel çocuk bilgileri ve ihtiyaç fikirleri."
  },
  {
    href: "/notification-preferences",
    title: "Bildirim tercihlerim",
    description: "Mesaj ve ilan hareketleri için tercihlerini düzenle."
  },
  {
    href: "/security",
    title: "Güvenlik",
    description: "Şifre ve hesap güvenliği ayarları."
  },
  {
    href: "/assistant",
    title: "BabyLoop Asistan",
    description: "Ürün seçimi ve güvenli alışveriş kontrol listeleri."
  }
] as const;

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
          ? "Favoriler, mesajlar, ilanlar ve aile ihtiyaçları burada."
          : "Favoriler ve mesajlar için giriş yap."
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
            {accountShortcuts.map((item) => (
              <MenuItem
                description={item.description}
                href={item.href}
                key={item.href}
                title={item.title}
              />
            ))}
          </View>
        </>
      )}

      <Link href="/" style={styles.link}>
        Keşfe dön
      </Link>
    </Screen>
  );
}

function MenuItem({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.menuItem}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </Pressable>
    </Link>
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
