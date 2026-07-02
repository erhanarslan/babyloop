import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { MobileCard } from "../src/ui/mobile-primitives";
import { Screen } from "../src/ui/screen";
import { colors, radius, spacing } from "../src/ui/theme";

const noteItems = [
  { title: "Beslenme", value: "2 saatte bir" },
  { title: "Bez", value: "Günlük takip" },
  { title: "Etkinlik", value: "Randevu ve oyun" },
  { title: "Alışveriş", value: "Bez, mama, ihtiyaç" }
] as const;

const reminderItems = [
  "Hafta sonu bez al",
  "Havuz etkinliği için 1 hafta önce hatırlat",
  "Uyku düzenini akşam not et"
] as const;

export default function ChildProfileRoute() {
  return (
    <Screen eyebrow="Çocuğum" title="Notlar">
      <MobileCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>Çocuğum</Text>
        <Text style={styles.heroText}>Günlük notlar ve hatırlatıcılar burada toplanır.</Text>
      </MobileCard>

      <View style={styles.grid}>
        {noteItems.map((item) => (
          <MobileCard key={item.title} style={styles.noteCard}>
            <Text style={styles.noteTitle}>{item.title}</Text>
            <Text style={styles.noteValue}>{item.value}</Text>
          </MobileCard>
        ))}
      </View>

      <MobileCard style={styles.reminderCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yaklaşanlar</Text>
          <Link href="/notification-preferences" style={styles.sectionLink}>
            Ayarlar
          </Link>
        </View>

        <View style={styles.reminderList}>
          {reminderItems.map((item) => (
            <View key={item} style={styles.reminderRow}>
              <View style={styles.dot} />
              <Text style={styles.reminderText}>{item}</Text>
            </View>
          ))}
        </View>
      </MobileCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.xs,
    backgroundColor: colors.surface
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  noteCard: {
    width: "48%",
    minHeight: 96,
    gap: spacing.xs
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  noteValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  reminderCard: {
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  sectionLink: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  reminderList: {
    gap: spacing.sm
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md
  },
  dot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  reminderText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19
  }
});
