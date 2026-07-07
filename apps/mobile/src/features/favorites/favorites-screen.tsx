import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Screen } from "../../ui/screen";
import {
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
import { fetchMobileFavorites, type MobileFavoriteListing } from "./favorites-api";

type FavoritesStatus = "idle" | "loading" | "ready" | "empty" | "guest" | "error";

export function FavoritesScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [favorites, setFavorites] = useState<MobileFavoriteListing[]>([]);
  const [status, setStatus] = useState<FavoritesStatus>("idle");
  const [error, setError] = useState<string | null>(null);

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

      <View style={styles.list}>
        {favorites.map((favorite) => (
          <MobileListingCard
            chips={buildMobileListingChips({
              conditionText: favorite.conditionText
            })}
            footerText={favorite.favoritedAt ? `Kaydedilme: ${formatDate(favorite.favoritedAt)}` : null}
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
  }
});
