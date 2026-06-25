import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  fetchMobileListings,
  type MobileListingSummary
} from "../listings/listings-api";
import { Paragraph, Screen } from "../../ui/screen";
import { DiscoverHeroBanner } from "./discover-hero-banner";

export function BrowseScreen() {
  const [listings, setListings] = useState<MobileListingSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadListings() {
      try {
        setStatus("loading");
        setError(null);

        const nextListings = await fetchMobileListings();

        if (!active) {
          return;
        }

        setListings(nextListings);
        setStatus(nextListings.length > 0 ? "ready" : "empty");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "İlanlar yüklenemedi.");
      }
    }

    void loadListings();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen
      eyebrow="Marketplace"
      title="Keşfet"
      subtitle="İkinci el bebek ve çocuk ürünlerini hızlıca incele."
    >
      <Paragraph>
        Ürünleri gör, favorilerine ekle veya satıcıyla güvenli mesajlaşmaya hazırlan.
      </Paragraph>

      <DiscoverHeroBanner />

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Son eklenenler</Text>
      </View>

      {status === "loading" ? <Paragraph>İlanlar yükleniyor...</Paragraph> : null}

      {status === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>İlanlar yüklenemedi</Text>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : null}

      {status === "empty" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Henüz ilan yok</Text>
          <Text style={styles.stateText}>Yeni ilanlar eklendiğinde burada görünecek.</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {listings.map((listing) => (
          <Link key={listing.id} href={`/listing/${encodeURIComponent(listing.id)}`} asChild>
            <Pressable style={styles.card}>
              {listing.imageUrl ? (
                <Image source={{ uri: listing.imageUrl }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Görsel yok</Text>
                </View>
              )}

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{listing.title}</Text>
                <Text style={styles.price}>{listing.priceText}</Text>
                <Text style={styles.meta}>{listing.locationText}</Text>
                {listing.conditionText ? (
                  <Text style={styles.condition}>{listing.conditionText}</Text>
                ) : null}
              </View>
            </Pressable>
          </Link>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    marginTop: 2
  },
  sectionTitle: {
    color: "#2f2521",
    fontSize: 20,
    fontWeight: "900"
  },
  list: {
    gap: 12
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f1d8ca",
    borderRadius: 22,
    backgroundColor: "#ffffff"
  },
  image: {
    width: "100%",
    height: 210,
    backgroundColor: "#f7dfd2"
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: 210,
    backgroundColor: "#f7dfd2"
  },
  imagePlaceholderText: {
    color: "#8a5f4c",
    fontSize: 15,
    fontWeight: "800"
  },
  cardBody: {
    gap: 5,
    padding: 14
  },
  cardTitle: {
    color: "#2f2521",
    fontSize: 18,
    fontWeight: "800"
  },
  price: {
    color: "#d45d3f",
    fontSize: 17,
    fontWeight: "900"
  },
  meta: {
    color: "#6d5d56",
    fontSize: 14
  },
  condition: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff1e8",
    color: "#8a5f4c",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  stateCard: {
    borderWidth: 1,
    borderColor: "#f1d8ca",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 6
  },
  stateTitle: {
    color: "#2f2521",
    fontSize: 16,
    fontWeight: "800"
  },
  stateText: {
    color: "#6d5d56",
    fontSize: 14,
    lineHeight: 20
  }
});
