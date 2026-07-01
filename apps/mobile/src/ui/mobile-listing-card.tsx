import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { MobileCard, MobileChip } from "./mobile-primitives";
import type { MobileListingCardChip } from "./mobile-listing-card-model";
export { buildMobileListingChips } from "./mobile-listing-card-model";
import { colors, radius, spacing } from "./theme";

type MobileListingCardProps = {
  title: string;
  priceText: string;
  locationText: string;
  imageUrl: string | null;
  chips?: MobileListingCardChip[];
  favoriteText?: string | null;
  footerText?: string | null;
  actions?: ReactNode;
  accessibilityLabel?: string;
  imageLabel?: string;
  onPress?: () => void;
  variant?: "horizontal" | "vertical";
};

export function MobileListingCard({
  accessibilityLabel,
  actions,
  chips = [],
  favoriteText,
  footerText,
  imageLabel = "İlan görseli",
  imageUrl,
  locationText,
  onPress,
  priceText,
  title,
  variant = "horizontal"
}: MobileListingCardProps) {
  const content = (
    <MobileCard style={styles.card}>
      <View style={variant === "vertical" ? styles.verticalBody : styles.horizontalBody}>
        {imageUrl ? (
          <Image
            accessibilityLabel={imageLabel}
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={variant === "vertical" ? styles.verticalImage : styles.horizontalImage}
          />
        ) : (
          <View
            accessibilityLabel="Ürün görseli yok"
            accessible
            style={variant === "vertical" ? styles.verticalImagePlaceholder : styles.horizontalImagePlaceholder}
          >
            <Text style={styles.imagePlaceholderText}>Görsel yok</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.main}>
            <Text numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.price}>
              {priceText}
            </Text>
            <View style={styles.iconTextRow}>
              <Ionicons
                accessibilityElementsHidden
                color={colors.subtle}
                importantForAccessibility="no"
                name="location-outline"
                size={14}
              />
              <Text numberOfLines={1} style={styles.location}>
                {locationText}
              </Text>
            </View>
          </View>

          {chips.length > 0 ? (
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <MobileChip key={chip.label} tone={chip.tone}>
                  {chip.label}
                </MobileChip>
              ))}
            </View>
          ) : null}

          {favoriteText ? (
            <View style={styles.iconTextRow}>
              <Ionicons
                accessibilityElementsHidden
                color={colors.subtle}
                importantForAccessibility="no"
                name="heart-outline"
                size={14}
              />
              <Text numberOfLines={1} style={styles.meta}>
                {favoriteText}
              </Text>
            </View>
          ) : null}

          {footerText ? <Text style={styles.footerText}>{footerText}</Text> : null}
        </View>
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </MobileCard>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? `İlanı aç: ${title}`}
      accessibilityRole="button"
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md
  },
  horizontalBody: {
    minHeight: 128,
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md
  },
  verticalBody: {
    gap: spacing.md
  },
  horizontalImage: {
    width: 106,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.cream
  },
  verticalImage: {
    width: "100%",
    height: 190,
    borderRadius: radius.md,
    backgroundColor: colors.cream
  },
  horizontalImagePlaceholder: {
    width: 106,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    padding: spacing.sm
  },
  verticalImagePlaceholder: {
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    padding: spacing.sm
  },
  imagePlaceholderText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  content: {
    minWidth: 0,
    flex: 1,
    justifyContent: "space-between",
    gap: spacing.sm
  },
  main: {
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19
  },
  price: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  iconTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  location: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  meta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  footerText: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  }
});
