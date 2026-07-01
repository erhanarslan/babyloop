import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadows, spacing } from "./theme";

type IconName = keyof typeof Ionicons.glyphMap;

type MobileCardProps = {
  accessibilityLabel?: string;
  accessible?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function MobileCard({
  accessibilityLabel,
  accessible,
  children,
  style
}: MobileCardProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible={accessible}
      style={[styles.card, style]}
    >
      {children}
    </View>
  );
}

type MobileButtonProps = {
  children: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  iconName?: IconName;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function MobileButton({
  accessibilityLabel,
  children,
  disabled = false,
  iconName,
  onPress,
  style,
  variant = "primary"
}: MobileButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === "primary" ? styles.buttonPrimary : null,
        variant === "secondary" ? styles.buttonSecondary : null,
        variant === "danger" ? styles.buttonDanger : null,
        variant === "ghost" ? styles.buttonGhost : null,
        disabled ? styles.disabled : null,
        style
      ]}
    >
      {iconName ? (
        <Ionicons
          accessibilityElementsHidden
          color={getButtonContentColor(variant)}
          importantForAccessibility="no"
          name={iconName}
          size={16}
          style={styles.buttonIcon}
        />
      ) : null}
      <Text style={[styles.buttonText, { color: getButtonContentColor(variant) }]}>
        {children}
      </Text>
    </Pressable>
  );
}

type MobileChipProps = {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning";
};

export function MobileChip({ children, tone = "neutral" }: MobileChipProps) {
  return (
    <View
      style={[
        styles.chip,
        tone === "primary" ? styles.chipPrimary : null,
        tone === "success" ? styles.chipSuccess : null,
        tone === "warning" ? styles.chipWarning : null
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chipText,
          tone === "success" ? styles.chipTextSuccess : null,
          tone === "warning" ? styles.chipTextWarning : null
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

type MobileStateProps = {
  title: string;
  message?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
};

export function MobileEmptyState({ actionLabel, message, onAction, title }: MobileStateProps) {
  return (
    <MobileCard style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateText}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <MobileButton onPress={onAction} variant="secondary">
          {actionLabel}
        </MobileButton>
      ) : null}
    </MobileCard>
  );
}

export function MobileErrorState({ actionLabel, message, onAction, title }: MobileStateProps) {
  return (
    <MobileCard style={[styles.stateCard, styles.errorStateCard]}>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.errorStateText}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <MobileButton onPress={onAction} variant="danger">
          {actionLabel}
        </MobileButton>
      ) : null}
    </MobileCard>
  );
}

export function MobileSkeleton({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <MobileCard style={styles.skeletonCard}>
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
      <Text style={styles.skeletonText}>{label}</Text>
    </MobileCard>
  );
}

export function MobileSectionHeader({
  description,
  title
}: {
  description?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

function getButtonContentColor(variant: NonNullable<MobileButtonProps["variant"]>): string {
  if (variant === "primary") {
    return colors.primaryForeground;
  }

  if (variant === "danger") {
    return colors.danger;
  }

  return colors.primaryDark;
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg
  },
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  buttonPrimary: {
    backgroundColor: colors.primary
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft
  },
  buttonDanger: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dangerSoft
  },
  buttonGhost: {
    backgroundColor: "transparent"
  },
  buttonIcon: {
    marginRight: spacing.sm
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center"
  },
  disabled: {
    opacity: 0.55
  },
  chip: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  chipPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft
  },
  chipSuccess: {
    borderColor: "#c7eadb",
    backgroundColor: colors.successSoft
  },
  chipWarning: {
    borderColor: "#f6dfb8",
    backgroundColor: colors.warningSoft
  },
  chipText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center"
  },
  chipTextSuccess: {
    color: colors.success
  },
  chipTextWarning: {
    color: colors.warning
  },
  stateCard: {
    gap: spacing.sm
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  errorStateCard: {
    borderColor: "#fecaca",
    backgroundColor: colors.dangerSoft
  },
  errorStateText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  skeletonCard: {
    gap: spacing.sm
  },
  skeletonLineWide: {
    height: 16,
    width: "70%",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft
  },
  skeletonLine: {
    height: 12,
    width: "46%",
    borderRadius: radius.sm,
    backgroundColor: colors.cream
  },
  skeletonText: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: "800"
  },
  sectionHeader: {
    gap: spacing.xs,
    paddingTop: spacing.xs
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.2
  },
  sectionDescription: {
    color: colors.subtle,
    fontSize: 14,
    lineHeight: 20
  }
});
