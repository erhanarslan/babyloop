import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { colors, radius, spacing } from "../../ui/theme";
import {
  formatMobileChildDateLabel,
  formatMobileChildLocalTimeFromDate,
  formatMobileChildTimeLabel,
  getMobileChildDateTimePickerDate,
  getMobileChildLocalTimePickerDate,
  mergeMobileChildDateTimePickerEventValue,
  mergeMobileChildLocalTimePickerEventValue,
  type MobileChildDateTimeFallbackKind,
  type MobileChildDateTimePickerMode
} from "./child-reminder-screen-state-model";

type MobileChildDateTimeFieldProps = {
  fallbackKind: MobileChildDateTimeFallbackKind;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

type MobileChildLocalTimeFieldProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function MobileChildDateTimeField({
  fallbackKind,
  label,
  onChange,
  value
}: MobileChildDateTimeFieldProps) {
  const [iosPickerMode, setIosPickerMode] = useState<MobileChildDateTimePickerMode | null>(null);

  function handlePickerChange(
    mode: MobileChildDateTimePickerMode,
    event: DateTimePickerEvent,
    selectedDate?: Date
  ): void {
    const nextValue = mergeMobileChildDateTimePickerEventValue({
      currentValue: value,
      eventType: event.type,
      fallbackKind,
      mode,
      selectedDate
    });
    onChange(nextValue);
    setIosPickerMode(null);
  }

  function openPicker(mode: MobileChildDateTimePickerMode): void {
    const pickerDate = getMobileChildDateTimePickerDate(value, fallbackKind);

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        display: "default",
        is24Hour: true,
        mode,
        onChange: (event, selectedDate) => handlePickerChange(mode, event, selectedDate),
        value: pickerDate
      });
      return;
    }

    setIosPickerMode(mode);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.selectorCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => openPicker("date")}
          style={styles.selectorColumn}
        >
          <Text style={styles.selectorEyebrow}>Tarih</Text>
          <Text style={styles.selectorValue}>{formatMobileChildDateLabel(value, fallbackKind)}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          accessibilityRole="button"
          onPress={() => openPicker("time")}
          style={styles.selectorColumn}
        >
          <Text style={styles.selectorEyebrow}>Saat</Text>
          <Text style={styles.selectorValue}>{formatMobileChildTimeLabel(value, fallbackKind)}</Text>
        </Pressable>
      </View>

      {Platform.OS !== "android" && iosPickerMode ? (
        <DateTimePicker
          display="spinner"
          is24Hour
          mode={iosPickerMode}
          onChange={(event, selectedDate) => handlePickerChange(iosPickerMode, event, selectedDate)}
          value={getMobileChildDateTimePickerDate(value, fallbackKind)}
        />
      ) : null}
    </View>
  );
}

export function MobileChildLocalTimeField({
  label,
  onChange,
  value
}: MobileChildLocalTimeFieldProps) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  function handlePickerChange(event: DateTimePickerEvent, selectedDate?: Date): void {
    onChange(
      mergeMobileChildLocalTimePickerEventValue({
        currentValue: value,
        eventType: event.type,
        selectedDate
      })
    );
    setIosPickerOpen(false);
  }

  function openPicker(): void {
    const pickerDate = getMobileChildLocalTimePickerDate(value);

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        display: "default",
        is24Hour: true,
        mode: "time",
        onChange: handlePickerChange,
        value: pickerDate
      });
      return;
    }

    setIosPickerOpen(true);
  }

  const displayValue = value.trim() || "10:00";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={openPicker}
        style={styles.selectorCard}
      >
        <View style={styles.selectorColumn}>
          <Text style={styles.selectorEyebrow}>Saat</Text>
          <Text style={styles.selectorValue}>{displayValue}</Text>
        </View>
      </Pressable>

      {Platform.OS !== "android" && iosPickerOpen ? (
        <DateTimePicker
          display="spinner"
          is24Hour
          mode="time"
          onChange={handlePickerChange}
          value={getMobileChildLocalTimePickerDate(value)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  selectorCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    overflow: "hidden"
  },
  selectorColumn: {
    flex: 1,
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  selectorEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900"
  },
  selectorValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  divider: {
    alignSelf: "stretch",
    backgroundColor: colors.border,
    width: 1
  }
});
