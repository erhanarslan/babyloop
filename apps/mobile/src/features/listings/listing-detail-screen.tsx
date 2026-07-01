import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileCard,
  MobileChip,
  MobileErrorState,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import { colors, radius, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { addMobileCartItem } from "../basket/basket-api";
import {
  fetchMobileFavorites,
  saveMobileFavorite
} from "../favorites/favorites-api";
import { startMobileConversationForListing } from "../messages/messages-api";
import {
  fetchMobileListingDetail,
  type MobileListingDetail
} from "./listings-api";

type FavoriteStatus = "idle" | "checking" | "pending";
type ConversationStatus = "idle" | "pending";
type CartStatus = "idle" | "pending" | "added";

export function ListingDetailScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const listingId = typeof params.listingId === "string" ? params.listingId : "demo";

  const [listing, setListing] = useState<MobileListingDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>("idle");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>("idle");
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [cartStatus, setCartStatus] = useState<CartStatus>("idle");
  const [cartError, setCartError] = useState<string | null>(null);
  const isOwnListing = Boolean(
    currentUser && listing?.sellerProfileId && currentUser.profile.id === listing.sellerProfileId
  );

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

  useEffect(() => {
    let active = true;

    async function loadFavoriteState() {
      setFavoriteError(null);

      if (!currentUser || !listing) {
        setIsFavorited(false);
        setFavoriteStatus("idle");
        return;
      }

      if (isOwnListing) {
        setIsFavorited(false);
        setFavoriteStatus("idle");
        return;
      }

      try {
        setFavoriteStatus("checking");

        const favorites = await fetchMobileFavorites();

        if (!active) {
          return;
        }

        setIsFavorited(favorites.some((favorite) => favorite.id === listingId));
        setFavoriteStatus("idle");
      } catch {
        if (!active) {
          return;
        }

        setIsFavorited(false);
        setFavoriteStatus("idle");
      }
    }

    void loadFavoriteState();

    return () => {
      active = false;
    };
  }, [currentUser, isOwnListing, listing, listingId]);

  async function handleFavoritePress() {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!listing || isOwnListing || favoriteStatus === "pending") {
      return;
    }

    try {
      setFavoriteStatus("pending");
      setFavoriteError(null);

      const nextFavorited = await saveMobileFavorite(listing.id, isFavorited);

      setIsFavorited(nextFavorited);
    } catch (favoriteActionError) {
      const message = favoriteActionError instanceof Error ? favoriteActionError.message : "";
      setFavoriteError(message.includes("own listing") ? "Bu ilan sana ait." : "Favori işlemi tamamlanamadı.");
    } finally {
      setFavoriteStatus("idle");
    }
  }

  async function handleContactSellerPress() {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!listing || isOwnListing || conversationStatus === "pending") {
      return;
    }

    try {
      setConversationStatus("pending");
      setConversationError(null);

      const conversation = await startMobileConversationForListing(listing.id);

      router.push(`/conversation/${encodeURIComponent(conversation.id)}`);
    } catch (startError) {
      setConversationError(startError instanceof Error ? startError.message : "Konuşma başlatılamadı.");
    } finally {
      setConversationStatus("idle");
    }
  }

  async function handleAddToCartPress() {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!listing || isOwnListing || listing.status !== "active" || cartStatus === "pending") {
      return;
    }

    try {
      setCartStatus("pending");
      setCartError(null);
      await addMobileCartItem(listing.id);
      setCartStatus("added");
    } catch (addError) {
      setCartStatus("idle");
      setCartError(addError instanceof Error ? addError.message : "İlan sepete eklenemedi.");
    }
  }

  return (
    <Screen eyebrow="İlan detayı" title={listing?.title ?? "İlan detayı"}>
      {status === "loading" ? <MobileSkeleton label="İlan detayı yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Keşfe dön"
          message={error}
          onAction={() => router.push("/")}
          title="İlan detayı yüklenemedi"
        />
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

          <View style={styles.metaChips}>
            <MobileChip tone={listing.status === "active" ? "success" : "neutral"}>
              {listing.statusText}
            </MobileChip>
            <MobileChip tone="primary">{listing.listingTypeText}</MobileChip>
            {listing.conditionText ? (
              <MobileChip>{listing.conditionText}</MobileChip>
            ) : null}
          </View>

          {isOwnListing ? (
            <MobileCard style={styles.ownerNotice}>
              <Text style={styles.ownerNoticeText}>Bu ilan sana ait.</Text>
            </MobileCard>
          ) : (
            <View style={styles.actionStack}>
              <MobileButton
                disabled={conversationStatus === "pending"}
                iconName="chatbubble-ellipses-outline"
                onPress={handleContactSellerPress}
                variant="primary"
              >
                {conversationStatus === "pending" ? "Konuşma açılıyor..." : "Satıcıya yaz"}
              </MobileButton>

              <MobileButton
                disabled={favoriteStatus === "pending"}
                iconName={isFavorited ? "heart" : "heart-outline"}
                onPress={handleFavoritePress}
                variant="secondary"
              >
                {favoriteStatus === "pending"
                  ? "Kaydediliyor..."
                  : isFavorited
                    ? "Favoriden çıkar"
                  : "Favoriye ekle"}
              </MobileButton>

              {listing.status === "active" ? (
                <MobileButton
                  accessibilityLabel="Sepete ekle"
                  disabled={cartStatus === "pending"}
                  iconName="basket-outline"
                  onPress={handleAddToCartPress}
                  variant="secondary"
                >
                  {cartStatus === "pending"
                    ? "Sepete ekleniyor..."
                    : cartStatus === "added"
                      ? "Sepete eklendi"
                      : "Sepete ekle"}
                </MobileButton>
              ) : null}
            </View>
          )}

          {favoriteStatus === "checking" ? (
            <Text style={styles.favoriteHint}>Favori durumu kontrol ediliyor...</Text>
          ) : null}

          {conversationError ? <Text style={styles.actionError}>{conversationError}</Text> : null}
          {favoriteError ? <Text style={styles.actionError}>{favoriteError}</Text> : null}
          {cartError ? <Text style={styles.actionError}>{cartError}</Text> : null}

          <MobileCard style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Güvenli mesajlaşma</Text>
            <Text style={styles.safetyText}>
              Telefon, e-posta, açık adres veya ödeme bilgisini mesajlarda paylaşmadan BabyLoop içinde kal.
            </Text>
          </MobileCard>

          <Paragraph>
            {listing.description ?? "Bu ilan için açıklama girilmemiş."}
          </Paragraph>
        </>
      ) : null}

      <MobileButton onPress={() => router.push("/")} variant="ghost">
        Keşfe dön
      </MobileButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.cream
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.cream
  },
  imageText: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800"
  },
  price: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: 15
  },
  metaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  actionStack: {
    gap: spacing.sm
  },
  favoriteHint: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700"
  },
  actionError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  ownerNotice: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft
  },
  ownerNoticeText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  safetyCard: {
    gap: spacing.xs
  },
  safetyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  safetyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
});
