import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, SectionHeader } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";

const listingSteps = [
  {
    title: "Ürün bilgileri",
    description: "Başlık, kategori ve ürün durumunu kısa ve anlaşılır şekilde hazırla."
  },
  {
    title: "Fotoğraf ekleme",
    description: "Ürünün genel görünümü, varsa kusurları ve aksesuarları ayrı ayrı göster."
  },
  {
    title: "Fiyat ve konum",
    description: "Fiyatı net yaz, teslim veya buluşma bilgisini mesajlaşmada kesinleştir."
  },
  {
    title: "Yayına alma",
    description: "İlanı kontrol et; telefon, e-posta veya açık adres paylaşmadan yayına hazırla."
  }
] as const;

const checklist = [
  "Başlıkta ürün tipi ve temel özellik olsun.",
  "Açıklamada kullanım süresi, durum ve eksik parça bilgisi yer alsın.",
  "Güvenlik sertifikası veya garanti gibi emin olmadığın iddiaları yazma."
] as const;

export function SellScreen() {
  const authSession = useAuthSession();

  if (!authSession.currentUser) {
    return (
      <Screen
        eyebrow="İlan Ver"
        title="Ürününü satmaya başla"
        subtitle="İlan hazırlamak için giriş yapman gerekiyor."
      >
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Hesabınla ilanlarını yönetebilirsin.</Text>
          <Text style={styles.stateText}>
            Giriş yaptıktan sonra favoriler, mesajlar ve ilan yönetimi aynı hesapta toplanır.
          </Text>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            </Pressable>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="İlan Ver"
      title="İlan hazırlığı"
      subtitle="Ürünü hızlıca düzenleyip güvenli bir ilan akışına hazırla."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Mobil ilan akışı</Text>
        <Text style={styles.heroText}>
          Bu ekranda ilan hazırlama adımlarını takip edebilirsin. Görsel yükleme ve yayınlama
          akışı tamamlandığında form buradan açılacak.
        </Text>
      </View>

      <SectionHeader
        title="Adımlar"
        description="İyi ilanlar kısa, net ve kontrol edilebilir bilgilerle hazırlanır."
      />

      <View style={styles.steps}>
        {listingSteps.map((step, index) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.checklistCard}>
        <Text style={styles.checklistTitle}>İlan yazarken</Text>
        {checklist.map((item) => (
          <Text key={item} style={styles.checklistItem}>
            {item}
          </Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 8
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  steps: {
    gap: 10
  },
  stepCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12
  },
  stepNumber: {
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft
  },
  stepNumberText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  stepContent: {
    flex: 1,
    gap: 4
  },
  stepTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  stepDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  checklistCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: 16,
    gap: 8
  },
  checklistTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  checklistItem: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  stateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10
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
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  }
});
