import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MobileButton, MobileCard } from "../../ui/mobile-primitives";
import { colors, radius, spacing } from "../../ui/theme";
import { Screen } from "../../ui/screen";
import { useAuthSession } from "../auth/auth-session";

const accountShortcuts = [
  {
    href: "/favorites",
    icon: "heart-outline",
    title: "Favorilerim",
    description: "Kaydettiğin ilanları tekrar aç."
  },
  {
    href: "/messages",
    icon: "chatbubble-ellipses-outline",
    title: "Mesajlarım",
    description: "Alıcı ve satıcı konuşmalarını takip et."
  },
  {
    href: "/my-listings",
    icon: "albums-outline",
    title: "İlanlarım",
    description: "Yayındaki, satılan ve arşivlenen ilanlarını yönet."
  },
  {
    href: "/sell",
    icon: "add-circle-outline",
    title: "İlan Ver",
    description: "Satmak istediğin ürünü hazırlamaya başla."
  },
  {
    href: "/child-profile",
    icon: "happy-outline",
    title: "Çocuğum",
    description: "Temel çocuk bilgileri ve ihtiyaç fikirleri."
  },
  {
    href: "/notification-preferences",
    icon: "notifications-outline",
    title: "Bildirim tercihlerim",
    description: "Mesaj ve ilan hareketleri için tercihlerini düzenle."
  },
  {
    href: "/security",
    icon: "shield-checkmark-outline",
    title: "Güvenlik",
    description: "Şifre ve hesap güvenliği ayarları."
  },
  {
    href: "/assistant",
    icon: "sparkles-outline",
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
      <MobileCard style={styles.profileCard}>
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
      </MobileCard>

      {authSession.status === "checking" ? (
        <StateCard title="Oturum kontrol ediliyor" text="Mevcut auth cookie/token bilgisi kontrol ediliyor." />
      ) : null}

      {!currentUser ? (
        <View style={styles.authActions}>
          <Link href="/login" asChild>
            <MobileButton>Giriş yap</MobileButton>
          </Link>

          <Link href="/register" asChild>
            <MobileButton variant="secondary">Hesap oluştur</MobileButton>
          </Link>
        </View>
      ) : (
        <>
          <MobileButton iconName="log-out-outline" onPress={handleLogout} variant="danger">
            Çıkış yap
          </MobileButton>

          <View style={styles.menu}>
            {accountShortcuts.map((item) => (
              <MenuItem
                description={item.description}
                href={item.href}
                icon={item.icon}
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

function MenuItem({
  title,
  description,
  href,
  icon
}: {
  title: string;
  description: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.menuItem}>
        <View style={styles.menuIcon}>
          <Ionicons
            accessibilityElementsHidden
            color={colors.primaryDark}
            importantForAccessibility="no"
            name={icon}
            size={18}
          />
        </View>
        <View style={styles.menuText}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuDescription}>{description}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function StateCard({ title, text }: { title: string; text: string }) {
  return (
    <MobileCard style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
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
    gap: spacing.sm
  },
  menu: {
    gap: spacing.sm
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 15,
    gap: spacing.md
  },
  menuIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft
  },
  menuText: {
    flex: 1,
    gap: spacing.xs
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
  stateCard: {
    gap: spacing.xs
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
