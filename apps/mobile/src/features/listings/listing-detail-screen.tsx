import { Link, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Paragraph, Screen } from "../../ui/screen";

export function ListingDetailScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const listingId = params.listingId ?? "demo";

  return (
    <Screen eyebrow="İlan detayı" title="Demo ilan">
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageText}>Görsel alanı</Text>
      </View>

      <Paragraph>
        Listing ID: {listingId}
      </Paragraph>

      <Paragraph>
        Bu ekran bir sonraki pakette gerçek ilan detay API response’una bağlanacak.
      </Paragraph>

      <Link href="/" style={styles.link}>
        Keşfe dön
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
    borderRadius: 22,
    backgroundColor: "#f7dfd2"
  },
  imageText: {
    color: "#8a5f4c",
    fontSize: 16,
    fontWeight: "800"
  },
  link: {
    color: "#d45d3f",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 6
  }
});
