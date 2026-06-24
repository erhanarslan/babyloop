import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  fetchMobileListingDetail,
  type MobileListingDetail
} from "./listings-api";
import { Paragraph, Screen } from "../../ui/screen";

export function ListingDetailScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const listingId = typeof params.listingId === "string" ? params.listingId : "demo";

  const [listing, setListing] = useState<MobileListingDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadListing() {
      try {
        setStatus("loading");
        setError(null);

        const nextListing = await fetchMobileListingDetail(listingId);

        if (!active) {
          return;
        }

        setListing(nextListing);
        setStatus("ready");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "İlan detayı yüklenemedi.");
      }
    }

    void loadListing();

    return () => {
      active = false;
    };
  }, [listingId]);

  return (
    <Screen eyebrow="İlan detayı" title={listing?.title ?? "İlan detayı"}>
      {status === "loading" ? <Paragraph>İlan detayı yükleniyor...</Paragraph> : null}

      {status === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>İlan detayı yüklenemedi</Text>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : null}

      {listing ? (
        <>
          {listing.imageUrl ? (
            <Image source={{ uri: listing.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageText}>Görsel yok</Text>
            </View>
          )}

          <Text style={styles.price}>{listing.priceText}</Text>
          <Text style={styles.meta}>{listing.locationText}</Text>

          {listing.conditionText ? (
            <Text style={styles.condition}>{listing.conditionText}</Text>
          ) : null}

          <Paragraph>
            {listing.description ?? "Bu ilan için açıklama girilmemiş."}
          </Paragraph>
        </>
      ) : null}

      <Link href="/" style={styles.link}>
        Keşfe dön
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: 260,
    borderRadius: 22,
    backgroundColor: "#f7dfd2"
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    borderRadius: 22,
    backgroundColor: "#f7dfd2"
  },
  imageText: {
    color: "#8a5f4c",
    fontSize: 16,
    fontWeight: "800"
  },
  price: {
    color: "#d45d3f",
    fontSize: 24,
    fontWeight: "900"
  },
  meta: {
    color: "#6d5d56",
    fontSize: 15
  },
  condition: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff1e8",
    color: "#8a5f4c",
    fontSize: 12,
    fontWeight: "800",
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
  },
  link: {
    color: "#d45d3f",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 6
  }
});
