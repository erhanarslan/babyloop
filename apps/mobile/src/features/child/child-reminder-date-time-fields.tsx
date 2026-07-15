import { useState, type ComponentType } from "react";
import {
  Alert,
  NativeModules,
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
  mergeMobileChildDateTimePickerValue,
  type MobileChildDateTimeFallbackKind,
  type MobileChildDateTimePickerMode
} from "./child-reminder-screen-state-model";

declare const require: (moduleName: string) => unknown;

type NativePickerEvent = {
  type?: "set" | "dismissed" | "neutralButtonPressed";
};

type NativePickerDisplay = "default" | "spinner" | "calendar" | "clock";

type NativeDateTimePickerProps = {
  display?: NativePickerDisplay;
  is24Hour?: boolean;
  mode: "date" | "time";
  onChange: (event: NativePickerEvent, selectedDate?: Date) => void;
  value: Date;
};

type NativeDateTimePickerAndroidApi = {
  open: (params: NativeDateTimePickerProps) => void;
};

type NativeDateTimePickerModule = {
  default?: ComponentType<NativeDateTimePickerProps>;
  DateTimePickerAndroid?: NativeDateTimePickerAndroidApi;
};

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

const nativePickerModule = getOptionalNativeDateTimePickerModule();
const NativeDateTimePicker = nativePickerModule?.default ?? null;
const DateTimePickerAndroid = nativePickerModule?.DateTimePickerAndroid ?? null;

export function MobileChildDateTimeField({
  fallbackKind,
  label,
  onChange,
  value
}: MobileChildDateTimeFieldProps) {
  const [iosPickerMode, setIosPickerMode] = useState<MobileChildDateTimePickerMode | null>(null);

  function handlePickerChange(
    mode: MobileChildDateTimePickerMode,
    event: NativePickerEvent,
    selectedDate?: Date
  ): void {
    if (event.type === "dismissed") {
      setIosPickerMode(null);
      return;
    }

    if (!selectedDate) {
      setIosPickerMode(null);
      return;
    }

    onChange(
      mergeMobileChildDateTimePickerValue({
        currentValue: value,
        fallbackKind,
        mode,
        selectedDate
      })
    );

    setIosPickerMode(null);
  }

  function openPicker(mode: MobileChildDateTimePickerMode): void {
    if (!nativePickerModule) {
      showNativePickerBuildRequiredAlert();
      return;
    }

    const pickerDate = getMobileChildDateTimePickerDate(value, fallbackKind);

    if (Platform.OS === "android" && DateTimePickerAndroid) {
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

      {!nativePickerModule ? (
        <Text style={styles.nativeBuildWarning}>
          Native tarih/saat seçici yeni Android development build sonrası aktif olur.
        </Text>
      ) : null}

      {NativeDateTimePicker && Platform.OS !== "android" && iosPickerMode ? (
        <NativeDateTimePicker
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

  function handlePickerChange(event: NativePickerEvent, selectedDate?: Date): void {
    if (event.type === "dismissed") {
      setIosPickerOpen(false);
      return;
    }

    if (selectedDate) {
      onChange(formatMobileChildLocalTimeFromDate(selectedDate));
    }

    setIosPickerOpen(false);
  }

  function openPicker(): void {
    if (!nativePickerModule) {
      showNativePickerBuildRequiredAlert();
      return;
    }

    const pickerDate = getMobileChildLocalTimePickerDate(value);

    if (Platform.OS === "android" && DateTimePickerAndroid) {
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

      {!nativePickerModule ? (
        <Text style={styles.nativeBuildWarning}>
          Native saat seçici yeni Android development build sonrası aktif olur.
        </Text>
      ) : null}

      {NativeDateTimePicker && Platform.OS !== "android" && iosPickerOpen ? (
        <NativeDateTimePicker
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

function getOptionalNativeDateTimePickerModule(): NativeDateTimePickerModule | null {
  try {
    if (!NativeModules.RNCDatePicker) {
      return null;
    }

    return require("@react-native-community/datetimepicker") as NativeDateTimePickerModule;
  } catch {
    return null;
  }
}

function showNativePickerBuildRequiredAlert(): void {
  Alert.alert(
    "Yeni build gerekli",
    "Native tarih/saat seçici için Android development build yeniden kurulmalı."
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
  },
  nativeBuildWarning: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  }
});
