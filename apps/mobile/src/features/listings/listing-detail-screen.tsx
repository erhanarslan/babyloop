import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
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

          <View style={styles.metaChips}>
            <Text style={styles.listingType}>{listing.listingTypeText}</Text>
            {listing.conditionText ? (
              <Text style={styles.condition}>{listing.conditionText}</Text>
            ) : null}
          </View>

          {isOwnListing ? (
            <View style={styles.ownerNotice}>
              <Text style={styles.ownerNoticeText}>Bu ilan sana ait.</Text>
            </View>
          ) : (
            <View style={styles.actionStack}>
              <Pressable
                disabled={conversationStatus === "pending"}
                onPress={handleContactSellerPress}
                style={[styles.contactButton, conversationStatus === "pending" ? styles.actionDisabled : null]}
              >
                <Text style={styles.contactButtonText}>
                  {conversationStatus === "pending" ? "Konuşma açılıyor..." : "Satıcıya yaz"}
                </Text>
              </Pressable>

              <Pressable
                disabled={favoriteStatus === "pending"}
                onPress={handleFavoritePress}
                style={[
                  styles.favoriteButton,
                  isFavorited ? styles.favoriteButtonSecondary : styles.favoriteButtonPrimary,
                  favoriteStatus === "pending" ? styles.actionDisabled : null
                ]}
              >
                <Text
                  style={[
                    styles.favoriteButtonText,
                    isFavorited ? styles.favoriteButtonTextSecondary : styles.favoriteButtonTextPrimary
                  ]}
                >
                  {favoriteStatus === "pending"
                    ? "Kaydediliyor..."
                    : isFavorited
                      ? "Favoriden çıkar"
                      : "Favoriye ekle"}
                </Text>
              </Pressable>
            </View>
          )}

          {favoriteStatus === "checking" ? (
            <Text style={styles.favoriteHint}>Favori durumu kontrol ediliyor...</Text>
          ) : null}

          {conversationError ? <Text style={styles.actionError}>{conversationError}</Text> : null}
          {favoriteError ? <Text style={styles.actionError}>{favoriteError}</Text> : null}

          <View style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Güvenli mesajlaşma</Text>
            <Text style={styles.safetyText}>
              Telefon, e-posta, açık adres veya ödeme bilgisini mesajlarda paylaşmadan BabyLoop içinde kal.
            </Text>
          </View>

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
    gap: 8
  },
  listingType: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  condition: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  actionStack: {
    gap: 10
  },
  contactButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14
  },
  contactButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  favoriteButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 14
  },
  favoriteButtonPrimary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  favoriteButtonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft
  },
  actionDisabled: {
    opacity: 0.65
  },
  favoriteButtonText: {
    fontSize: 15,
    fontWeight: "900"
  },
  favoriteButtonTextPrimary: {
    color: colors.primaryDark
  },
  favoriteButtonTextSecondary: {
    color: colors.primaryDark
  },
  favoriteHint: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700"
  },
  actionError: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  ownerNotice: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 13
  },
  ownerNoticeText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  safetyCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 5
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
  stateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6
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
  },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 6
  }
});
