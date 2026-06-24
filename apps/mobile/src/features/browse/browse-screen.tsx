import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getApiBaseUrl } from "../../config/api";
import { Paragraph, Screen } from "../../ui/screen";

export function BrowseScreen() {
  return (
    <Screen eyebrow="Marketplace" title="BabyLoop">
      <Paragraph>
        İlk mobil iskelet hazır. Bu ekran bir sonraki pakette API-backed browse listesine bağlanacak.
      </Paragraph>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>API base URL</Text>
        <Text style={styles.cardText}>{getApiBaseUrl()}</Text>
      </View>

      <Link href="/listing/demo" style={styles.link}>
        Demo ilan detayına git
      </Link>

      <Link href="/login" style={styles.link}>
        Giriş ekranı
      </Link>

      <Link href="/account" style={styles.link}>
        Hesabım
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#f1d8ca",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 6
  },
  cardTitle: {
    color: "#2f2521",
    fontSize: 16,
    fontWeight: "800"
  },
  cardText: {
    color: "#6d5d56",
    fontSize: 14
  },
  link: {
    color: "#d45d3f",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 6
  }
});
