import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  buildMobileListingChips,
  MobileListingCard
} from "../../ui/mobile-listing-card";
import { MobileCard, MobileSectionHeader, MobileSkeleton } from "../../ui/mobile-primitives";
import { colors, radius, spacing } from "../../ui/theme";
import { formatMobileListingAgeRange } from "../listings/listing-age-range-model";
import type { MobileChildLifecycleRecommendationGroup } from "./child-reminders-api";

type ChildAgeRecommendationsProps = {
  group: MobileChildLifecycleRecommendationGroup | null;
  status: "loading" | "ready" | "error";
};

export function ChildAgeRecommendations({ group, status }: ChildAgeRecommendationsProps) {
  const router = useRouter();
  const matchedListings = group?.matchedListings ?? [];

  return (
    <MobileCard style={styles.card}>
      <MobileSectionHeader
        description="Güncel yaşa ve satıcının belirttiği yaş aralığına göre eşleşir."
        title="Yaşa uygun ilanlar"
      />

      <View style={styles.safetyNotice}>
        <Text style={styles.safetyText}>
          Yaş eşleşmesi uygunluk garantisi değildir. Ürün etiketini, ölçüleri ve ürün durumunu kontrol et.
        </Text>
      </View>

      {status === "loading" ? <MobileSkeleton label="Yaş eşleşmeleri kontrol ediliyor..." /> : null}

      {status === "error" ? (
        <Text style={styles.stateText}>Yaşa uygun ilanlar şu anda yüklenemedi.</Text>
      ) : null}

      {status === "ready" && matchedListings.length === 0 ? (
        <Text style={styles.stateText}>Güncel yaşa uygun yayında ilan bulunamadı.</Text>
      ) : null}

      {status === "ready" && matchedListings.length > 0 ? (
        <View style={styles.list}>
          {matchedListings.map((listing) => (
            <MobileListingCard
              accessibilityLabel={`Yaşa uygun ilanı aç: ${listing.title}`}
              chips={buildMobileListingChips({
                isDemo: listing.isDemo,
                conditionText: listing.conditionText,
                listingTypeText: listing.listingTypeText,
                statusText: listing.statusText
              })}
              footerText={formatMobileListingAgeRange(
                listing.recommendedAgeMinMonths,
                listing.recommendedAgeMaxMonths
              )}
              imageLabel={`Ürün görseli: ${listing.title}`}
              imageUrl={listing.imageUrl}
              key={listing.id}
              locationText={listing.locationText}
              onPress={() => router.push(`/listing/${encodeURIComponent(listing.id)}`)}
              priceText={listing.priceText}
              title={listing.title}
            />
          ))}
        </View>
      ) : null}
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md
  },
  safetyNotice: {
    borderWidth: 1,
    borderColor: "#efd7a7",
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    padding: spacing.md
  },
  safetyText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18
  },
  stateText: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    padding: spacing.md
  },
  list: {
    gap: spacing.md
  }
});
