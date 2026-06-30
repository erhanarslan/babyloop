import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import {
  fetchMobileListings,
  type MobileListingSummary
} from "../listings/listings-api";
import { DiscoverHeroBanner } from "./discover-hero-banner";

export function BrowseScreen() {
  const [listings, setListings] = useState<MobileListingSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const loadListings = useCallback(async (query: string) => {
    try {
      setStatus("loading");
      setError(null);

      const nextListings = await fetchMobileListings({
        q: query,
        limit: 20
      });

      setListings(nextListings);
      setStatus(nextListings.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      setListings([]);
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "İlanlar yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void loadListings(appliedQuery);
  }, [appliedQuery, loadListings]);

  function handleSearch() {
    setAppliedQuery(draftQuery.trim());
  }

  function handleClearSearch() {
    setDraftQuery("");
    setAppliedQuery("");
  }

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

      <View style={styles.searchCard}>
        <Text style={styles.searchTitle}>Ne arıyorsun?</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDraftQuery}
          onSubmitEditing={handleSearch}
          placeholder="Bebek arabası, oto koltuğu, oyuncak..."
          placeholderTextColor={colors.subtle}
          returnKeyType="search"
          style={styles.searchInput}
          value={draftQuery}
        />

        <View style={styles.searchActions}>
          <Pressable onPress={handleSearch} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Ara</Text>
          </Pressable>

          <Pressable
            disabled={!draftQuery && !appliedQuery}
            onPress={handleClearSearch}
            style={[styles.secondaryButton, !draftQuery && !appliedQuery ? styles.disabledButton : null]}
          >
            <Text style={styles.secondaryButtonText}>Temizle</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>
          {appliedQuery ? `"${appliedQuery}" için sonuçlar` : "Son eklenenler"}
        </Text>
      </View>

      {status === "loading" ? <Paragraph>İlanlar yükleniyor...</Paragraph> : null}

      {status === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>İlanlar yüklenemedi</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable onPress={() => void loadListings(appliedQuery)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "empty" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Eşleşen ilan yok</Text>
          <Text style={styles.stateText}>
            Farklı bir arama dene ya da daha sonra tekrar bak.
          </Text>
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
                <Text numberOfLines={2} style={styles.cardTitle}>{listing.title}</Text>
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
  searchCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10
  },
  searchTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  searchActions: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.5
  },
  sectionHeading: {
    marginTop: 2
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  list: {
    gap: 12
  },
  card: {
    ...shadows.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface
  },
  image: {
    width: "100%",
    height: 210,
    backgroundColor: colors.cream
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: 210,
    backgroundColor: colors.cream
  },
  imagePlaceholderText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  cardBody: {
    gap: 5,
    padding: 14
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  price: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: 14
  },
  condition: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5
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
    fontSize: 16,
    fontWeight: "800"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  }
});
