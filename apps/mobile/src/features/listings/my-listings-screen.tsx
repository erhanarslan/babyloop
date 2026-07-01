import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileEmptyState,
  MobileErrorState
} from "../../ui/mobile-primitives";
import {
  buildMobileListingChips,
  MobileListingCard
} from "../../ui/mobile-listing-card";
import { colors, radius, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileMyListings,
  updateMobileListingStatus,
  type MobileListingStatus,
  type MobileMyListingSummary
} from "./listings-api";
import { getMobileListingStatusActions } from "./my-listings-model";

type LoadStatus = "loading" | "ready" | "error";

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
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadListings()}
          title="İlanlar yüklenemedi"
        />
      ) : null}

      {status === "ready" && listings.length === 0 ? (
        <MobileEmptyState
          actionLabel="İlan ver"
          message="İlk ilanını oluşturduğunda burada yönetebilirsin."
          onAction={() => router.push("/sell")}
          title="Henüz ilan yok"
        />
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

  return (
    <MobileListingCard
      actions={
        actions.length > 0 ? (
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <MobileButton
              disabled={pending}
              key={`${listing.id}-${action.status}`}
              onPress={() => onStatusAction(action.status)}
              iconName={getActionIconName(action.label)}
              style={styles.actionButton}
              variant={action.tone}
            >
              {pending ? "Güncelleniyor..." : action.label}
            </MobileButton>
          ))}
        </View>
        ) : null
      }
      chips={buildMobileListingChips({
        conditionText: listing.conditionText,
        listingTypeText: listing.listingTypeText,
        statusText: listing.statusText
      })}
      favoriteText={`${listing.favoriteCount ?? 0} favori`}
      imageUrl={listing.imageUrl}
      locationText={listing.locationText}
      onPress={onOpen}
      priceText={listing.priceText}
      title={listing.title}
    />
  );
}

function getActionIconName(label: string): "archive-outline" | "cart-outline" | "refresh-outline" {
  if (label === "Satıldı yap") {
    return "cart-outline";
  }

  if (label === "Arşivle") {
    return "archive-outline";
  }

  return "refresh-outline";
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    flex: 1
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
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: colors.primaryForeground,
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
});
