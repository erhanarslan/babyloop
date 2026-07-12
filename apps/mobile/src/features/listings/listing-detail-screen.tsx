import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileCard,
  MobileChip,
  MobileErrorState,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import { colors, radius, shadows, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  clearPendingMobileLoginIntent,
  setPendingMobileLoginIntent
} from "../auth/mobile-login-intent";
import { addMobileCartItem } from "../basket/basket-api";
import {
  fetchMobileFavorites,
  saveMobileFavorite
} from "../favorites/favorites-api";
import { startMobileConversationForListing } from "../messages/messages-api";
import {
  getMobileListingDetailActionState,
  getMobileListingGalleryImageUrls
} from "./listing-detail-model";
import {
  fetchMobileListingDetail,
  type MobileListingDetail
} from "./listings-api";

type FavoriteStatus = "idle" | "checking" | "pending";
type ConversationStatus = "idle" | "pending";
type CartStatus = "idle" | "pending" | "added";

export function ListingDetailScreen() {
  const params = useLocalSearchParams<{
    listingId?: string;
    postLoginAction?: string;
  }>();
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const listingId = typeof params.listingId === "string" ? params.listingId : "demo";

  const [listing, setListing] = useState<MobileListingDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>("idle");
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>("idle");
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [cartStatus, setCartStatus] = useState<CartStatus>("idle");
  const [cartError, setCartError] = useState<string | null>(null);
  const [handledPostLoginAction, setHandledPostLoginAction] = useState<string | null>(null);

  const isOwnListing = Boolean(
    currentUser && listing?.sellerProfileId && currentUser.profile.id === listing.sellerProfileId
  );
  const actionState = listing
    ? getMobileListingDetailActionState({
        isOwnListing,
        listingType: listing.listingType,
        status: listing.status
      })
    : null;
  const galleryImageUrls = useMemo(
    () => listing ? getMobileListingGalleryImageUrls(listing) : [],
    [listing]
  );
  const activeImageUrl = selectedImageUrl ?? galleryImageUrls[0] ?? null;

  useEffect(() => {
    let active = true;

    async function loadListing() {
      try {
        setStatus("loading");
        setError(null);
        setFavoriteError(null);
        setConversationError(null);
        setCartError(null);

        const nextListing = await fetchMobileListingDetail(listingId);

        if (!active) {
          return;
        }

        setListing(nextListing);
        setSelectedImageUrl(null);
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

      if (!currentUser || !listing || isOwnListing || !actionState?.canFavorite) {
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
  }, [actionState?.canFavorite, currentUser, isOwnListing, listing, listingId]);

  function redirectToLoginForListingAction(action: "favorite" | "message" | "cart") {
    if (!listing) {
      router.push("/login");
      return;
    }

    setPendingMobileLoginIntent({
      action,
      listingId: listing.id
    });

    const redirectTo = `/listing/${encodeURIComponent(listing.id)}`;

    router.push(
      `/login?redirectTo=${encodeURIComponent(redirectTo)}&postLoginAction=${encodeURIComponent(action)}`
    );
  }

  async function handleFavoritePress() {
    if (!currentUser) {
      redirectToLoginForListingAction("favorite");
      return;
    }

    if (!listing || !actionState?.canFavorite || favoriteStatus === "pending") {
      return;
    }

    const previousFavorited = isFavorited;
    const nextFavorited = !previousFavorited;

    try {
      setFavoriteStatus("pending");
      setFavoriteError(null);
      setIsFavorited(nextFavorited);

      const savedFavoriteState = await saveMobileFavorite(listing.id, nextFavorited);

      setIsFavorited(savedFavoriteState);
    } catch (favoriteActionError) {
      setIsFavorited(previousFavorited);
      const message = favoriteActionError instanceof Error ? favoriteActionError.message : "";
      setFavoriteError(message.includes("own listing") ? "Bu ilan sana ait." : message || "Favori işlemi tamamlanamadı.");
    } finally {
      setFavoriteStatus("idle");
    }
  }

  async function handleContactSellerPress() {
    if (!currentUser) {
      redirectToLoginForListingAction("message");
      return;
    }

    if (!listing || !actionState?.canMessageSeller || conversationStatus === "pending") {
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
      redirectToLoginForListingAction("cart");
      return;
    }

    if (!listing || !actionState?.canAddToCart || cartStatus === "pending") {
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

  useEffect(() => {
    const postLoginAction =
      typeof params.postLoginAction === "string" ? params.postLoginAction : null;
    const postLoginActionKey = postLoginAction ? `${listingId}:${postLoginAction}` : null;

    if (
      !postLoginAction ||
      !postLoginActionKey ||
      handledPostLoginAction === postLoginActionKey ||
      !currentUser ||
      !listing ||
      !actionState
    ) {
      return;
    }

    setHandledPostLoginAction(postLoginActionKey);
    clearPendingMobileLoginIntent();
    router.replace(`/listing/${encodeURIComponent(listing.id)}`);

    if (postLoginAction === "message" && actionState.canMessageSeller) {
      void handleContactSellerPress();
      return;
    }

    if (postLoginAction === "favorite" && actionState.canFavorite && !isFavorited) {
      void handleFavoritePress();
      return;
    }

    if (postLoginAction === "cart" && actionState.canAddToCart) {
      void handleAddToCartPress();
    }
  }, [
    actionState,
    currentUser,
    handledPostLoginAction,
    isFavorited,
    listing,
    listingId,
    params.postLoginAction,
    router
  ]);

  return (
    <Screen
      eyebrow={listing?.statusText ?? "İlan"}
      title={listing?.title ?? "İlan detayı"}
      subtitle={listing ? `${listing.priceText} · ${listing.locationText}` : undefined}
    >
      {status === "loading" ? <MobileSkeleton label="İlan detayı yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Keşfe dön"
          message={error}
          onAction={() => router.push("/")}
          title="İlan detayı yüklenemedi"
        />
      ) : null}

      {listing && actionState ? (
        <>
          <MobileCard style={styles.heroCard}>
            {activeImageUrl ? (
              <Image resizeMode="cover" source={{ uri: activeImageUrl }} style={styles.heroImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons color={colors.primaryDark} name="image-outline" size={34} />
                <Text style={styles.imageText}>Görsel yok</Text>
              </View>
            )}

            {galleryImageUrls.length > 1 ? (
              <ScrollView
                contentContainerStyle={styles.thumbnailRow}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {galleryImageUrls.map((imageUrl, index) => (
                  <Pressable
                    accessibilityLabel={`İlan görseli ${index + 1}`}
                    accessibilityRole="button"
                    key={`${imageUrl}-${index}`}
                    onPress={() => setSelectedImageUrl(imageUrl)}
                    style={[
                      styles.thumbnailButton,
                      activeImageUrl === imageUrl ? styles.thumbnailButtonActive : null
                    ]}
                  >
                    <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.thumbnailImage} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </MobileCard>

          <View style={styles.priceBlock}>
            <Text style={styles.price}>{listing.priceText}</Text>
            <Text style={styles.location}>{listing.locationText}</Text>
          </View>

          <View style={styles.metaChips}>
            <MobileChip tone={actionState.statusTone}>{listing.statusText}</MobileChip>
            <MobileChip tone="primary">{listing.listingTypeText}</MobileChip>
            {listing.conditionText ? <MobileChip>{listing.conditionText}</MobileChip> : null}
          </View>

          {actionState.notice ? (
            <MobileCard style={styles.noticeCard}>
              <Text style={styles.noticeText}>{actionState.notice}</Text>
            </MobileCard>
          ) : null}

          <MobileCard style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>
                {(listing.sellerDisplayName ?? "S").slice(0, 1).toLocaleUpperCase("tr-TR")}
              </Text>
            </View>
            <View style={styles.sellerTextBlock}>
              <Text style={styles.sellerLabel}>Satıcı</Text>
              <Text numberOfLines={1} style={styles.sellerName}>
                {listing.sellerDisplayName ?? "BabyLoop satıcısı"}
              </Text>
            </View>
          </MobileCard>

          {!isOwnListing ? (
            <View style={styles.actionGrid}>
              <MobileButton
                disabled={!actionState.canMessageSeller || conversationStatus === "pending"}
                iconName="chatbubble-ellipses-outline"
                onPress={handleContactSellerPress}
                style={styles.primaryAction}
                variant="primary"
              >
                {conversationStatus === "pending" ? "Açılıyor..." : "Satıcıya yaz"}
              </MobileButton>

              <MobileButton
                disabled={!actionState.canFavorite || favoriteStatus === "pending"}
                iconName={isFavorited ? "heart" : "heart-outline"}
                onPress={handleFavoritePress}
                style={styles.secondaryAction}
                variant="secondary"
              >
                {favoriteStatus === "pending"
                  ? "Kaydediliyor..."
                  : isFavorited
                    ? "Kaydedildi"
                    : "Favori"}
              </MobileButton>

              {actionState.canAddToCart ? (
                <MobileButton
                  accessibilityLabel="Sepete ekle"
                  disabled={cartStatus === "pending"}
                  iconName="basket-outline"
                  onPress={handleAddToCartPress}
                  style={styles.secondaryAction}
                  variant="secondary"
                >
                  {cartStatus === "pending"
                    ? "Ekleniyor..."
                    : cartStatus === "added"
                      ? "Sepette"
                      : "Sepet"}
                </MobileButton>
              ) : null}
            </View>
          ) : null}

          {favoriteStatus === "checking" ? (
            <Text style={styles.helperText}>Favori durumu kontrol ediliyor...</Text>
          ) : null}

          {conversationError ? <Text style={styles.actionError}>{conversationError}</Text> : null}
          {favoriteError ? <Text style={styles.actionError}>{favoriteError}</Text> : null}
          {cartError ? <Text style={styles.actionError}>{cartError}</Text> : null}

          <MobileCard style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Açıklama</Text>
            <Text style={styles.descriptionText}>
              {listing.description ?? "Bu ilan için açıklama girilmemiş."}
            </Text>
          </MobileCard>

          <MobileCard style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Almadan önce kontrol et</Text>
            <Text style={styles.safetyText}>
              Durumunu, eksik parçasını, teslim detayını ve ek fotoğraf ihtiyacını satıcıya BabyLoop mesajları üzerinden sor.
            </Text>
          </MobileCard>
        </>
      ) : null}

      <MobileButton onPress={() => router.push("/")} variant="ghost">
        Keşfe dön
      </MobileButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 0,
    overflow: "hidden"
  },
  heroImage: {
    width: "100%",
    height: 330,
    backgroundColor: colors.cream
  },
  imagePlaceholder: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.cream
  },
  imageText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  thumbnailRow: {
    gap: spacing.sm,
    padding: spacing.md
  },
  thumbnailButton: {
    width: 58,
    height: 58,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft
  },
  thumbnailButtonActive: {
    borderColor: colors.primary
  },
  thumbnailImage: {
    width: "100%",
    height: "100%"
  },
  priceBlock: {
    gap: 4
  },
  price: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6
  },
  location: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  metaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  noticeCard: {
    borderColor: "#f6dfb8",
    backgroundColor: colors.warningSoft,
    padding: spacing.md
  },
  noticeText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md
  },
  sellerAvatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft
  },
  sellerAvatarText: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900"
  },
  sellerTextBlock: {
    flex: 1,
    minWidth: 0
  },
  sellerLabel: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "900"
  },
  sellerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  primaryAction: {
    flexBasis: "100%"
  },
  secondaryAction: {
    flexGrow: 1,
    minWidth: 132
  },
  helperText: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  actionError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  descriptionCard: {
    gap: spacing.sm
  },
  descriptionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  descriptionText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  safetyCard: {
    ...shadows.card,
    gap: spacing.xs,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft
  },
  safetyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  safetyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  }
});
