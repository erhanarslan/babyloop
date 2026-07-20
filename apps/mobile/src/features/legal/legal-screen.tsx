import { Ionicons } from "@expo/vector-icons";
import { LEGAL_DOCUMENT_VERSIONS } from "@babyloop/shared";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { buildWebUrl } from "../../config/web";
import { MobileCard } from "../../ui/mobile-primitives";
import { Screen } from "../../ui/screen";
import { colors, radius, spacing } from "../../ui/theme";

const documents = [
  ["KVKK Aydınlatma Metni", "/legal/kvkk", LEGAL_DOCUMENT_VERSIONS.kvkkNotice],
  ["Gizlilik Politikası", "/legal/privacy", LEGAL_DOCUMENT_VERSIONS.privacy],
  ["Kullanım Koşulları", "/legal/terms", LEGAL_DOCUMENT_VERSIONS.terms],
  ["Çerez ve yerel depolama", "/legal/cookies", LEGAL_DOCUMENT_VERSIONS.cookies],
  ["Yapay zekâ bildirimi", "/legal/ai-notice", LEGAL_DOCUMENT_VERSIONS.aiNotice],
  ["Pazaryeri güvenliği", "/legal/marketplace", LEGAL_DOCUMENT_VERSIONS.marketplace],
  ["Hesap ve veri silme", "/legal/data-deletion", LEGAL_DOCUMENT_VERSIONS.dataDeletion],
  ["İletişim ve başvuru", "/support/contact", "güncel"]
] as const;

export function LegalScreen() {
  return (
    <Screen
      hasTabBar={false}
      eyebrow="Yasal ve güven"
      title="Belgeler ve veri hakları"
      subtitle="Yasal metinleri web görünümünde açabilir, veri silme ve destek kanallarına ulaşabilirsin."
    >
      <MobileCard style={styles.infoCard}>
        <Ionicons name="shield-checkmark-outline" size={24} color={colors.primaryDark} />
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>Çocukların bağımsız kullanımına yönelik değildir</Text>
          <Text style={styles.infoBody}>Çocuk profili ve notları yalnızca ebeveyn veya yasal temsilci yönetmelidir.</Text>
        </View>
      </MobileCard>

      <View style={styles.list}>
        {documents.map(([title, path, version]) => (
          <Pressable
            accessibilityRole="link"
            key={path}
            onPress={() => void Linking.openURL(buildWebUrl(path))}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{title}</Text>
              <Text style={styles.itemMeta}>Sürüm {version}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  infoText: { flex: 1, gap: 4 },
  infoTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  infoBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  list: { gap: 10 },
  item: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  itemText: { flex: 1, gap: 3 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  itemMeta: { color: colors.subtle, fontSize: 12 },
  pressed: { opacity: 0.72 }
});
