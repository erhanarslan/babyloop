import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileEmptyState,
  MobileErrorState,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import {
  buildMobileListingChips,
  MobileListingCard
} from "../../ui/mobile-listing-card";
import { spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { fetchMobileFavorites, removeMobileFavorite, type MobileFavoriteListing } from "./favorites-api";

type FavoritesStatus = "idle" | "loading" | "ready" | "empty" | "guest" | "error";

export function FavoritesScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [favorites, setFavorites] = useState<MobileFavoriteListing[]>([]);
  const [status, setStatus] = useState<FavoritesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [removingFavoriteId, setRemovingFavoriteId] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!authSession.currentUser) {
      setFavorites([]);
      setStatus(authSession.status === "checking" ? "loading" : "guest");
      return;
    }

    try {
      setStatus("loading");
      setError(null);

      const nextFavorites = await fetchMobileFavorites();

      setFavorites(nextFavorites);
      setStatus(nextFavorites.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      setFavorites([]);
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Favoriler yüklenemedi.");
    }
  }, [authSession.currentUser, authSession.status]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  async function handleRemoveFavorite(favorite: MobileFavoriteListing) {
    if (removingFavoriteId) {
      return;
    }

    try {
      setError(null);
      setRemovingFavoriteId(favorite.id);

      await removeMobileFavorite(favorite.id);

      setFavorites((currentFavorites) => {
        const nextFavorites = currentFavorites.filter((item) => item.id !== favorite.id);

        if (nextFavorites.length === 0) {
          setStatus("empty");
        }

        return nextFavorites;
      });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Favoriden çıkarılamadı.");
    } finally {
      setRemovingFavoriteId(null);
    }
  }

  return (
    <Screen title="Favoriler">
      {status === "loading" ? <MobileSkeleton label="Favoriler yükleniyor..." /> : null}

      {status === "guest" ? (
        <MobileEmptyState
          actionLabel="Giriş yap"
          message="Favorilerini görmek ve ilanları kaydetmek için hesabına giriş yap."
          onAction={() => router.push("/login")}
          title="Giriş gerekli"
        />
      ) : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadFavorites()}
          title="Favoriler kullanılamıyor"
        />
      ) : null}

      {status === "empty" ? (
        <MobileEmptyState
          actionLabel="Keşfe dön"
          message="Keşfet ekranından ürünleri açıp kaydettiğinde burada görünecek."
          onAction={() => router.push("/")}
          title="Henüz favori yok"
        />
      ) : null}

      {error && status === "ready" ? <Text style={styles.inlineError}>{error}</Text> : null}

      <View style={styles.list}>
        {favorites.map((favorite) => (
          <MobileListingCard
            actions={
              <>
                <MobileButton
                  accessibilityLabel={`Favori ilanı aç: ${favorite.title}`}
                  onPress={() => router.push(`/listing/${encodeURIComponent(favorite.id)}`)}
                  variant="secondary"
                >
                  Detay
                </MobileButton>
                <MobileButton
                  accessibilityLabel={`Favoriden çıkar: ${favorite.title}`}
                  disabled={removingFavoriteId === favorite.id}
                  iconName="trash-outline"
                  onPress={() => void handleRemoveFavorite(favorite)}
                  variant="danger"
                >
                  {removingFavoriteId === favorite.id ? "Çıkarılıyor..." : "Çıkar"}
                </MobileButton>
              </>
            }
            chips={buildMobileListingChips({
              isDemo: favorite.isDemo,
              conditionText: favorite.conditionText,
              listingTypeText: favorite.listingTypeText,
              statusText: favorite.statusText
            })}
            favoriteText="Favorilerinde"
            footerText={favorite.favoritedAt ? `Kaydedildi: ${formatDate(favorite.favoritedAt)}` : null}
            imageUrl={favorite.imageUrl}
            key={favorite.id}
            locationText={favorite.locationText}
            onPress={() => router.push(`/listing/${encodeURIComponent(favorite.id)}`)}
            priceText={favorite.priceText}
            title={favorite.title}
          />
        ))}
      </View>
    </Screen>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR");
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md
  },
  inlineError: {
    color: "#b42318",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  }
});
