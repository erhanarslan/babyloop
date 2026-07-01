import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
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
          <Text numberOfLines={2} style={styles.title}>
            {listing.title}
          </Text>
          <Text style={styles.price}>{listing.priceText}</Text>
          <Text numberOfLines={1} style={styles.location}>
            {listing.locationText}
          </Text>

          <Text numberOfLines={1} style={styles.listingMetaLine}>
            {[listing.statusText, listing.listingTypeText, listing.conditionText].filter(Boolean).join(" • ")}
          </Text>

          <Text style={styles.meta}>{listing.favoriteCount ?? 0} favori</Text>
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
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  list: {
    gap: 13
  },
  card: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 12
  },
  cardBody: {
    flexDirection: "row",
    gap: 12
  },
  image: {
    width: 96,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.cream
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    width: 96,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    padding: 8
  },
  imagePlaceholderText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  cardContent: {
    flex: 1,
    gap: 5
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20
  },
  price: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900"
  },
  location: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  listingMetaLine: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
    paddingTop: 2
  },
  meta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary
  },
  actionButtonSecondary: {
    backgroundColor: colors.surfaceSoft
  },
  actionButtonDanger: {
    backgroundColor: "#fff0ed"
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "900"
  },
  actionButtonTextPrimary: {
    color: "#ffffff"
  },
  actionButtonTextSecondary: {
    color: colors.primaryDark
  },
  actionButtonTextDanger: {
    color: "#b42318"
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
