import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileMyListings,
  updateMobileListingStatus,
  type MobileListingStatus,
  type MobileMyListingSummary
} from "./listings-api";
import { getMobileListingStatusActions } from "./my-listings-model";

type LoadStatus = "loading" | "ready" | "error";
type MyListingActionIconName = "archive-outline" | "cart-outline" | "refresh-outline";

export function MyListingsScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [listings, setListings] = useState<MobileMyListingSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    if (!authSession.currentUser) {
      setListings([]);
      setStatus("ready");
      setError(null);
      return;
    }

    try {
      setStatus("loading");
      setError(null);

      const nextListings = await fetchMobileMyListings();

      setListings(nextListings);
      setStatus("ready");
    } catch (loadError) {
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "İlanların yüklenemedi.");
    }
  }, [authSession.currentUser]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  async function handleStatusAction(listingId: string, nextStatus: MobileListingStatus) {
    if (pendingListingId) {
      return;
    }

    try {
      setPendingListingId(listingId);
      setError(null);

      const updatedListing = await updateMobileListingStatus(listingId, nextStatus);

      setListings((currentListings) =>
        currentListings.map((listing) => (listing.id === listingId ? updatedListing : listing))
      );

      await loadListings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "İlan durumu güncellenemedi.");
    } finally {
      setPendingListingId(null);
    }
  }

  if (!authSession.currentUser) {
    return (
      <Screen
        eyebrow="İlanlarım"
        title="İlanlarını yönet"
        subtitle="Kendi ilanlarını görmek ve güncellemek için giriş yap."
      >
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Hesap gerekli</Text>
          <Text style={styles.stateText}>İlanlarını yönetmek için BabyLoop hesabına giriş yapmalısın.</Text>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            </Pressable>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="İlanlarım"
      title="İlanlarını yönet"
      subtitle="Yayındaki, satılan ve arşivlenen ilanlarını buradan takip et."
    >
      <View style={styles.headerActions}>
        <Pressable onPress={() => router.replace("/account")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Hesaba dön</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/sell")} style={styles.headerPrimaryButton}>
          <Text style={styles.headerPrimaryButtonText}>Yeni ilan ver</Text>
        </Pressable>
      </View>

      {status === "loading" ? <Paragraph>İlanların yükleniyor...</Paragraph> : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void loadListings()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "ready" && listings.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Henüz ilan yok</Text>
          <Text style={styles.stateText}>İlk ilanını oluşturduğunda burada yönetebilirsin.</Text>
          <Pressable onPress={() => router.push("/sell")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>İlan ver</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.list}>
        {listings.map((listing) => (
          <MyListingCard
            key={listing.id}
            listing={listing}
            onOpen={() => router.push(`/listing/${encodeURIComponent(listing.id)}`)}
            onStatusAction={(nextStatus) => void handleStatusAction(listing.id, nextStatus)}
            pending={pendingListingId === listing.id}
          />
        ))}
      </View>
    </Screen>
  );
}

function MyListingCard({
  listing,
  onOpen,
  onStatusAction,
  pending
}: {
  listing: MobileMyListingSummary;
  onOpen: () => void;
  onStatusAction: (status: MobileListingStatus) => void;
  pending: boolean;
}) {
  const actions = getMobileListingStatusActions(listing.status);
  const chips = [listing.statusText, listing.listingTypeText, listing.conditionText].filter(
    isNonEmptyLabel
  );

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.cardBody}>
        {listing.imageUrl ? (
          <Image source={{ uri: listing.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>Görsel yok</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          <View style={styles.cardMain}>
            <Text numberOfLines={2} style={styles.title}>
              {listing.title}
            </Text>
            <Text numberOfLines={1} style={styles.price}>
              {listing.priceText}
            </Text>
            <View style={styles.iconTextRow}>
              <Ionicons
                accessibilityElementsHidden
                color={colors.subtle}
                importantForAccessibility="no"
                name="location-outline"
                size={14}
              />
              <Text numberOfLines={1} style={styles.location}>
                {listing.locationText}
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <ListingChip key={`${listing.id}-${chip}`} label={chip} />
            ))}
          </View>

          <View style={styles.favoriteRow}>
            <Ionicons
              accessibilityElementsHidden
              color={colors.subtle}
              importantForAccessibility="no"
              name="heart-outline"
              size={14}
            />
            <Text style={styles.meta}>{listing.favoriteCount ?? 0} favori</Text>
          </View>
        </View>
      </Pressable>

      {actions.length > 0 ? (
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <Pressable
              disabled={pending}
              key={`${listing.id}-${action.status}`}
              onPress={() => onStatusAction(action.status)}
              style={[
                styles.actionButton,
                action.tone === "primary" ? styles.actionButtonPrimary : null,
                action.tone === "danger" ? styles.actionButtonDanger : null,
                action.tone === "secondary" ? styles.actionButtonSecondary : null,
                pending ? styles.actionButtonDisabled : null
              ]}
            >
              <Ionicons
                accessibilityElementsHidden
                color={getActionIconColor(action.tone)}
                importantForAccessibility="no"
                name={getActionIconName(action.label)}
                size={15}
                style={styles.actionButtonIcon}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  action.tone === "primary" ? styles.actionButtonTextPrimary : null,
                  action.tone === "danger" ? styles.actionButtonTextDanger : null,
                  action.tone === "secondary" ? styles.actionButtonTextSecondary : null
                ]}
              >
                {pending ? "Güncelleniyor..." : action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ListingChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text numberOfLines={1} style={styles.chipText}>
        {label}
      </Text>
    </View>
  );
}

function isNonEmptyLabel(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getActionIconName(label: string): MyListingActionIconName {
  if (label === "Satıldı yap") {
    return "cart-outline";
  }

  if (label === "Arşivle") {
    return "archive-outline";
  }

  return "refresh-outline";
}

function getActionIconColor(tone: "primary" | "secondary" | "danger"): string {
  if (tone === "primary") {
    return colors.primaryForeground;
  }

  if (tone === "danger") {
    return colors.danger;
  }

  return colors.primaryDark;
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  headerPrimaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  headerPrimaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: "900"
  },
  list: {
    gap: spacing.md
  },
  card: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md,
    minHeight: 128
  },
  image: {
    width: 106,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.cream
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    width: 106,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    padding: spacing.sm
  },
  imagePlaceholderText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
    gap: spacing.sm,
    minWidth: 0
  },
  cardMain: {
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19
  },
  price: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  iconTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  location: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  chip: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  chipText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center"
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  meta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary
  },
  actionButtonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft
  },
  actionButtonDanger: {
    backgroundColor: colors.dangerSoft
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  actionButtonIcon: {
    marginRight: 5
  },
  actionButtonTextPrimary: {
    color: colors.primaryForeground
  },
  actionButtonTextSecondary: {
    color: colors.primaryDark
  },
  actionButtonTextDanger: {
    color: colors.danger
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
    fontSize: 17,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: radius.lg,
    backgroundColor: "#fff1f2",
    padding: 14,
    gap: 10
  },
  errorText: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  primaryButton: {
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
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  retryButtonText: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "900"
  }
});
