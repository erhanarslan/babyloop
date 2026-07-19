import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../../ui/theme";
import {
  formatMobileListingAgeRange,
  mobileListingAgeRangeOptions,
  parseMobileListingAgeRange
} from "./listing-age-range-model";

type MobileListingAgeRangeFieldProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
};

export function MobileListingAgeRangeField({
  disabled = false,
  onChange,
  value
}: MobileListingAgeRangeFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedRange = parseMobileListingAgeRange(value);
  const selectedLabel = selectedRange
    ? formatMobileListingAgeRange(selectedRange.minMonths, selectedRange.maxMonths)
    : "Yaş aralığı seç";
  const customOption = value.startsWith("custom:") && selectedRange
    ? { value, label: selectedLabel }
    : null;
  const options = customOption
    ? [customOption, ...mobileListingAgeRangeOptions]
    : mobileListingAgeRangeOptions;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Önerilen yaş</Text>
      <Pressable
        accessibilityLabel={`Önerilen yaş: ${selectedLabel}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: isOpen }}
        disabled={disabled}
        onPress={() => setIsOpen((current) => !current)}
        style={[styles.trigger, disabled ? styles.disabled : null]}
      >
        <Text numberOfLines={1} style={styles.triggerText}>{selectedLabel}</Text>
        <Ionicons
          accessibilityElementsHidden
          color={colors.muted}
          importantForAccessibility="no"
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={19}
        />
      </Pressable>

      {isOpen ? (
        <View accessibilityRole="menu" style={styles.menu}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <Pressable
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={[styles.option, selected ? styles.optionSelected : null]}
              >
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                  {option.label}
                </Text>
                {selected ? <Ionicons color={colors.primaryDark} name="checkmark" size={18} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.helper}>
        Uygunluk garantisi değildir; ürün etiketini ve ölçülerini ayrıca kontrol et.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  trigger: {
    minHeight: 48,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md
  },
  triggerText: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  menu: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface
  },
  option: {
    minHeight: 44,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionSelected: {
    backgroundColor: colors.surfaceSoft
  },
  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  optionTextSelected: {
    color: colors.primaryDark,
    fontWeight: "900"
  },
  helper: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  disabled: {
    opacity: 0.55
  }
});
