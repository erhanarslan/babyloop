import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { MobileCard } from "../../src/ui/mobile-primitives";
import { Screen } from "../../src/ui/screen";
import { colors, radius, spacing } from "../../src/ui/theme";

const reminderSettings = [
  { title: "Beslenme", value: "2 saatte bir" },
  { title: "Bez takibi", value: "Günlük" },
  { title: "Etkinlik", value: "1 hafta ve 1 gün önce" },
  { title: "Alışveriş", value: "Seçilen gün sabah 10:00" }
] as const;

export default function NotificationPreferencesRoute() {
  return (
    <Screen eyebrow="Bildirimler" title="Hatırlatıcılar">
      <MobileCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>Çocuk notları için bildirimler</Text>
        <Text style={styles.heroText}>
          Beslenme, bez, etkinlik ve alışveriş hatırlatmalarını buradan takip edebilirsin.
        </Text>
      </MobileCard>

      <View style={styles.list}>
        {reminderSettings.map((item) => (
          <MobileCard key={item.title} style={styles.settingCard}>
            <View>
              <Text style={styles.settingTitle}>{item.title}</Text>
              <Text style={styles.settingValue}>{item.value}</Text>
            </View>
            <Text style={styles.status}>Hazır</Text>
          </MobileCard>
        ))}
      </View>

      <Link href="/child-profile" style={styles.link}>
        Çocuğum notlarına dön
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.xs
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  list: {
    gap: spacing.sm
  },
  settingCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  settingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  settingValue: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  status: {
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  link: {
    alignSelf: "center",
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
    paddingVertical: 8
  }
});
