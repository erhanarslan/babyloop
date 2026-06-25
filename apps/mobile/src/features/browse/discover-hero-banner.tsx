import { useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { colors, radius, shadows } from "../../ui/theme";

const bannerItems = [
  {
    eyebrow: "Güvenli keşif",
    title: "Almadan önce kontrol et",
    description: "Durum, eksik parça ve teslim detaylarını mesajlaşmada netleştir."
  },
  {
    eyebrow: "Yeni ilanlar",
    title: "Bebek ve çocuk ürünleri",
    description: "Son eklenen ilanları hızlıca incele, beğendiklerini favorilerine al."
  },
  {
    eyebrow: "İyi ilan ipucu",
    title: "Fotoğraf ve açıklama önemli",
    description: "Ürünü satarken kusurları ve aksesuarları açıkça paylaş."
  }
] as const;

const autoAdvanceMs = 2000;

export function DiscoverHeroBanner() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (containerWidth <= 0) {
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
  }, [containerWidth]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (containerWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    setActiveIndex(Math.max(0, Math.min(nextIndex, bannerItems.length - 1)));
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
          <View key={item.title} style={[styles.slide, { width: containerWidth || 1 }]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.eyebrow}</Text>
            </View>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            <Text numberOfLines={2} style={styles.description}>
              {item.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {bannerItems.map((item, index) => (
          <View
            key={item.title}
            style={[styles.dot, index === activeIndex ? styles.dotActive : null]}
          />
        ))}
      </View>
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
    height: 112
  },
  slider: {
    flex: 1
  },
  slide: {
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 5
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  description: {
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
