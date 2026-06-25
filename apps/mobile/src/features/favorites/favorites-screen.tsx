import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { useAuthSession } from "../auth/auth-session";
import { fetchMobileFavorites, type MobileFavoriteListing } from "./favorites-api";

type FavoritesStatus = "idle" | "loading" | "ready" | "empty" | "guest" | "error";

export function FavoritesScreen() {
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
    <Screen
      eyebrow="Profilin"
      title="Favoriler"
      subtitle="Kaydettiğin ilanları mobilde hızlıca tekrar aç."
    >
      {status === "loading" ? <Paragraph>Favoriler yükleniyor...</Paragraph> : null}

      {status === "guest" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Giriş gerekli</Text>
          <Text style={styles.stateText}>
            Favorilerini görmek ve ilanları kaydetmek için hesabına giriş yap.
          </Text>

          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Favoriler kullanılamıyor</Text>
          <Text style={styles.stateText}>{error}</Text>

          <Pressable onPress={() => void loadFavorites()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "empty" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Henüz favori yok</Text>
          <Text style={styles.stateText}>
            Keşfet ekranından ürünleri açıp kaydettiğinde burada görünecek.
          </Text>

          <Link href="/" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Keşfe dön</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      <View style={styles.list}>
        {favorites.map((favorite) => (
          <Link key={favorite.id} href={`/listing/${encodeURIComponent(favorite.id)}`} asChild>
            <Pressable style={styles.card}>
              {favorite.imageUrl ? (
                <Image source={{ uri: favorite.imageUrl }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Görsel yok</Text>
                </View>
              )}

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{favorite.title}</Text>
                <Text style={styles.price}>{favorite.priceText}</Text>
                <Text style={styles.meta}>{favorite.locationText}</Text>

                {favorite.conditionText ? (
                  <Text style={styles.condition}>{favorite.conditionText}</Text>
                ) : null}

                {favorite.favoritedAt ? (
                  <Text style={styles.favoritedAt}>Kaydedilme: {formatDate(favorite.favoritedAt)}</Text>
                ) : null}
              </View>
            </Pressable>
          </Link>
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
    gap: 12
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f1d8ca",
    borderRadius: 22,
    backgroundColor: "#ffffff"
  },
  image: {
    width: "100%",
    height: 190,
    backgroundColor: "#f7dfd2"
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: 190,
    backgroundColor: "#f7dfd2"
  },
  imagePlaceholderText: {
    color: "#8a5f4c",
    fontSize: 15,
    fontWeight: "800"
  },
  cardBody: {
    gap: 5,
    padding: 14
  },
  cardTitle: {
    color: "#2f2521",
    fontSize: 18,
    fontWeight: "800"
  },
  price: {
    color: "#d45d3f",
    fontSize: 17,
    fontWeight: "900"
  },
  meta: {
    color: "#6d5d56",
    fontSize: 14
  },
  condition: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff1e8",
    color: "#8a5f4c",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  favoritedAt: {
    color: "#8a5f4c",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  stateCard: {
    borderWidth: 1,
    borderColor: "#f1d8ca",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 10
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
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#d45d3f",
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
    backgroundColor: "#fff1e8",
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: "#8a5f4c",
    fontSize: 15,
    fontWeight: "900"
  }
});
