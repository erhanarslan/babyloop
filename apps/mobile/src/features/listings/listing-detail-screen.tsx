import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileFavorites,
  saveMobileFavorite
} from "../favorites/favorites-api";
import {
  fetchMobileListingDetail,
  type MobileListingDetail
} from "./listings-api";
import { Paragraph, Screen } from "../../ui/screen";

type FavoriteStatus = "idle" | "checking" | "pending";

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
  const isOwnListing = Boolean(currentUser && listing?.sellerProfileId && currentUser.profile.id === listing.sellerProfileId);

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

          {isOwnListing ? (
            <View style={styles.ownerNotice}>
              <Text style={styles.ownerNoticeText}>Bu ilan sana ait.</Text>
            </View>
          ) : (
            <Pressable
              disabled={favoriteStatus === "pending"}
              onPress={handleFavoritePress}
              style={[
                styles.favoriteButton,
                isFavorited ? styles.favoriteButtonSecondary : styles.favoriteButtonPrimary,
                favoriteStatus === "pending" ? styles.favoriteButtonDisabled : null
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
          )}

          {favoriteStatus === "checking" ? (
            <Text style={styles.favoriteHint}>Favori durumu kontrol ediliyor...</Text>
          ) : null}

          {favoriteError ? (
            <Text style={styles.favoriteError}>{favoriteError}</Text>
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
  favoriteButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 14
  },
  favoriteButtonPrimary: {
    backgroundColor: "#d45d3f"
  },
  favoriteButtonSecondary: {
    borderWidth: 1,
    borderColor: "#f1d8ca",
    backgroundColor: "#fff1e8"
  },
  favoriteButtonDisabled: {
    opacity: 0.65
  },
  favoriteButtonText: {
    fontSize: 15,
    fontWeight: "900"
  },
  favoriteButtonTextPrimary: {
    color: "#ffffff"
  },
  favoriteButtonTextSecondary: {
    color: "#8a5f4c"
  },
  favoriteHint: {
    color: "#8a5f4c",
    fontSize: 13,
    fontWeight: "700"
  },
  favoriteError: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  ownerNotice: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1d8ca",
    borderRadius: 999,
    backgroundColor: "#fff1e8",
    paddingVertical: 13
  },
  ownerNoticeText: {
    color: "#8a5f4c",
    fontSize: 15,
    fontWeight: "900"
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
