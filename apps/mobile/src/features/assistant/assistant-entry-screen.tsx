import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, SectionHeader } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";

const assistantTopics = [
  {
    title: "Ürün seçimi kontrol listesi",
    description: "Bebek arabası, oto koltuğu, oyuncak ve tekstil için genel kontrol noktaları."
  },
  {
    title: "İkinci el alışveriş güvenliği",
    description: "Satıcıya sorulacak sorular, ürün durumu ve teslim öncesi kontroller."
  },
  {
    title: "Yaşa göre ihtiyaç fikirleri",
    description: "Yaş dönemine göre ürün ve hazırlık fikirlerini kısa listeler halinde düşün."
  },
  {
    title: "İlan açıklaması yazma yardımı",
    description: "Başlık, açıklama ve fotoğraf checklist’i için ürün odaklı yardım."
  }
] as const;

export function AssistantEntryScreen() {
  return (
    <Screen
      eyebrow="Asistan"
      title="BabyLoop Asistan"
      subtitle="Ürün seçimi, ilan hazırlığı ve güvenli alışveriş için kısa yardım noktaları."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Marketplace yardım alanı</Text>
        <Text style={styles.heroText}>
          Asistan deneyimi ürün kontrol listeleri, ilan hazırlama ve güvenli alışveriş konularında
          çalışacak şekilde konumlandırıldı.
        </Text>
      </View>

      <SectionHeader title="Konu başlıkları" description="Sağlık, tanı veya tedavi tavsiyesi vermez." />

      <View style={styles.topicList}>
        {assistantTopics.map((topic) => (
          <View key={topic.title} style={styles.topicCard}>
            <Text style={styles.topicTitle}>{topic.title}</Text>
            <Text style={styles.topicDescription}>{topic.description}</Text>
          </View>
        ))}
      </View>

      <Link href="/" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Keşfe dön</Text>
        </Pressable>
      </Link>
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
  topicList: {
    gap: 10
  },
  topicCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 15,
    gap: 5
  },
  topicTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  topicDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  }
});
