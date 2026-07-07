import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAndroidNavigationBarVisibility } from "../lib/android-navigation-bar";
import {
  getMobileKeyboardAvoidingBehavior,
  getMobileScreenContentBottomPadding
} from "./mobile-layout";
import { colors } from "./theme";

type ScreenProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  hasTabBar?: boolean;
  keyboardAvoiding?: boolean;
};

export function Screen({
  title,
  eyebrow,
  subtitle,
  headerAction,
  children,
  hasTabBar = true,
  keyboardAvoiding = true
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const androidNavigationVisibility = useAndroidNavigationBarVisibility() ?? "hidden";
  const bottomPadding = getMobileScreenContentBottomPadding({
    androidNavigationVisibility,
    hasTabBar,
    platformOS: Platform.OS,
    safeAreaBottom: insets.bottom
  });
  const keyboardAvoidingBehavior = getMobileKeyboardAvoidingBehavior(Platform.OS);

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      enabled={keyboardAvoiding}
      keyboardVerticalOffset={0}
      style={styles.keyboardRoot}
    >
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View pointerEvents="none" style={styles.backgroundPattern}>
          <View style={[styles.patternDot, styles.patternDotPrimary]} />
          <View style={[styles.patternDot, styles.patternDotPeach]} />
          <View style={[styles.patternDot, styles.patternDotMint]} />
          <View style={[styles.patternRing, styles.patternRingTop]} />
          <View style={[styles.patternRing, styles.patternRingBottom]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
          </View>

          <View style={styles.body}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function SectionHeader({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  patternDot: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.14
  },
  patternDotPrimary: {
    top: 92,
    right: 24,
    width: 48,
    height: 48,
    backgroundColor: colors.peach
  },
  patternDotPeach: {
    top: 212,
    left: 18,
    width: 34,
    height: 34,
    backgroundColor: colors.cream
  },
  patternDotMint: {
    right: 42,
    bottom: 178,
    width: 28,
    height: 28,
    backgroundColor: colors.surfaceSoft
  },
  patternRing: {
    position: "absolute",
    borderWidth: 8,
    borderColor: colors.surfaceSoft,
    borderRadius: 999,
    opacity: 0.42
  },
  patternRingTop: {
    top: 138,
    left: -18,
    width: 58,
    height: 58
  },
  patternRingBottom: {
    right: -20,
    bottom: 298,
    width: 66,
    height: 66
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: 16,
    gap: 14
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 6
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  headerAction: {
    paddingTop: 2
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 34
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  body: {
    gap: 16
  },
  paragraph: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  sectionHeader: {
    gap: 4,
    paddingTop: 4
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  sectionDescription: {
    color: colors.subtle,
    fontSize: 14,
    lineHeight: 20
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  pillText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  }
});
