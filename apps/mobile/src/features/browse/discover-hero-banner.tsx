import { useEffect, useRef, useState } from "react";
import {
  ImageBackground,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { colors, radius, shadows } from "../../ui/theme";
import type { MobileListingSummary } from "../listings/listings-api";

const autoAdvanceMs = 2000;
const maxBannerItems = 5;

export function DiscoverHeroBanner({
  autoAdvanceEnabled = true,
  listings,
  onListingPress
}: {
  autoAdvanceEnabled?: boolean;
  listings: MobileListingSummary[];
  onListingPress: (listingId: string) => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const bannerItems = listings.filter((listing) => listing.imageUrl).slice(0, maxBannerItems);

  useEffect(() => {
    if (!autoAdvanceEnabled || containerWidth <= 0 || bannerItems.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setActiveIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % bannerItems.length;

        scrollRef.current?.scrollTo({
          x: nextIndex * containerWidth,
          animated: true
        });

        return nextIndex;
      });
    }, autoAdvanceMs);

    return () => clearInterval(timer);
  }, [autoAdvanceEnabled, bannerItems.length, containerWidth]);

  useEffect(() => {
    if (activeIndex >= bannerItems.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, bannerItems.length]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (containerWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    setActiveIndex(Math.max(0, Math.min(nextIndex, Math.max(0, bannerItems.length - 1))));
  }

  if (bannerItems.length === 0) {
    return (
      <View style={[styles.container, styles.fallbackContainer]}>
        <Text style={styles.fallbackTitle}>Son ilan görselleri burada dönecek</Text>
        <Text style={styles.fallbackText}>Fotoğraflı ilanlar eklendiğinde Keşfet alanı ürün odaklı görünür.</Text>
      </View>
    );
  }

  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={styles.container}
    >
      <ScrollView
        horizontal
        onMomentumScrollEnd={handleMomentumEnd}
        pagingEnabled
        ref={scrollRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.slider}
      >
        {bannerItems.map((item) => (
          <Pressable
            accessibilityLabel={`İlanı aç: ${item.title}`}
            key={item.id}
            onPress={() => onListingPress(item.id)}
            style={[styles.slide, { width: containerWidth || 1 }]}
          >
            <ImageBackground
              imageStyle={styles.slideImage}
              resizeMode="cover"
              source={{ uri: item.imageUrl ?? "" }}
              style={styles.imageBackground}
            >
              <View style={styles.imageOverlay} />
              <View style={styles.slideContent}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Son ilan</Text>
                </View>
                <Text numberOfLines={1} style={styles.title}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.description}>
                  {item.priceText}
                  {item.locationText ? ` · ${item.locationText}` : ""}
                </Text>
              </View>
            </ImageBackground>
          </Pressable>
        ))}
      </ScrollView>

      {bannerItems.length > 1 ? (
        <View style={styles.dots}>
          {bannerItems.map((item, index) => (
            <View
              key={item.id}
              style={[styles.dot, index === activeIndex ? styles.dotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...shadows.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    height: 154
  },
  fallbackContainer: {
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 6
  },
  slider: {
    flex: 1
  },
  slide: {
    overflow: "hidden"
  },
  imageBackground: {
    flex: 1,
    justifyContent: "flex-end"
  },
  slideImage: {
    borderRadius: radius.xl
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.34)"
  },
  slideContent: {
    gap: 6,
    padding: 16
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  title: {
    color: colors.primaryForeground,
    fontSize: 19,
    fontWeight: "900"
  },
  description: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    lineHeight: 18
  },
  fallbackTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  fallbackText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  dots: {
    position: "absolute",
    right: 14,
    bottom: 12,
    flexDirection: "row",
    gap: 5
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.border
  },
  dotActive: {
    width: 15,
    backgroundColor: colors.primary
  }
});
