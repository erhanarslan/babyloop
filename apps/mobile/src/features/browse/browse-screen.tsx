import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileSectionHeader,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import {
  buildMobileListingChips,
  MobileListingCard
} from "../../ui/mobile-listing-card";
import { colors, radius, spacing } from "../../ui/theme";
import {
  fetchMobileListings,
  type MobileListingSummary
} from "../listings/listings-api";
import { DiscoverHeroBanner } from "./discover-hero-banner";

export function BrowseScreen() {
  const router = useRouter();
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

      <MobileCard style={styles.searchCard}>
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
          <MobileButton onPress={handleSearch} style={styles.searchButton}>
            Ara
          </MobileButton>

          <MobileButton
            disabled={!draftQuery && !appliedQuery}
            onPress={handleClearSearch}
            style={styles.searchButton}
            variant="secondary"
          >
            Temizle
          </MobileButton>
        </View>
      </MobileCard>

      <MobileSectionHeader title={appliedQuery ? `"${appliedQuery}" için sonuçlar` : "Son eklenenler"} />

      {status === "loading" ? <MobileSkeleton label="İlanlar yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadListings(appliedQuery)}
          title="İlanlar yüklenemedi"
        />
      ) : null}

      {status === "empty" ? (
        <MobileEmptyState
          message="Farklı bir arama dene ya da daha sonra tekrar bak."
          title="Eşleşen ilan yok"
        />
      ) : null}

      <View style={styles.list}>
        {listings.map((listing) => (
          <MobileListingCard
            accessibilityLabel={`İlanı aç: ${listing.title}`}
            chips={buildMobileListingChips({
              conditionText: listing.conditionText,
              listingTypeText: listing.listingTypeText,
              statusText: listing.statusText
            })}
            imageUrl={listing.imageUrl}
            key={listing.id}
            locationText={listing.locationText}
            onPress={() => router.push(`/listing/${encodeURIComponent(listing.id)}`)}
            priceText={listing.priceText}
            title={listing.title}
            variant="vertical"
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    gap: spacing.sm
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
    gap: spacing.sm
  },
  searchButton: {
    flex: 1
  },
  list: {
    gap: spacing.md
  }
});
