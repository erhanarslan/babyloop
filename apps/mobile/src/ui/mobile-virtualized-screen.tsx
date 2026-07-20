import type { ReactElement, ReactNode } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  type ListRenderItem
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAndroidNavigationBarVisibility } from "../lib/android-navigation-bar";
import {
  getMobileKeyboardAvoidingBehavior,
  getMobileScreenContentBottomPadding
} from "./mobile-layout";
import { colors, spacing } from "./theme";

type MobileVirtualizedScreenProps<TItem> = {
  data: TItem[];
  title: string;
  renderItem: ListRenderItem<TItem>;
  keyExtractor: (item: TItem, index: number) => string;
  eyebrow?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  listHeader?: ReactNode;
  listEmpty?: ReactNode;
  listFooter?: ReactNode;
  overlay?: ReactNode;
  hasTabBar?: boolean;
  keyboardAvoiding?: boolean;
  initialNumToRender?: number;
  maxToRenderPerBatch?: number;
  updateCellsBatchingPeriod?: number;
  windowSize?: number;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function MobileVirtualizedScreen<TItem>({
  data,
  eyebrow,
  hasTabBar = true,
  headerAction,
  initialNumToRender = 6,
  keyboardAvoiding = true,
  maxToRenderPerBatch = 6,
  keyExtractor,
  listEmpty,
  listFooter,
  listHeader,
  onEndReached,
  onRefresh,
  overlay,
  refreshing = false,
  renderItem,
  subtitle,
  title,
  updateCellsBatchingPeriod = 40,
  windowSize = 7
}: MobileVirtualizedScreenProps<TItem>) {
  const insets = useSafeAreaInsets();
  const androidNavigationVisibility = useAndroidNavigationBarVisibility() ?? "hidden";
  const bottomPadding = getMobileScreenContentBottomPadding({
    androidNavigationVisibility,
    hasTabBar,
    platformOS: Platform.OS,
    safeAreaBottom: insets.bottom
  });
  const keyboardAvoidingBehavior = getMobileKeyboardAvoidingBehavior(Platform.OS);
  const header = (
    <View style={styles.headerStack}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
      </View>
      {listHeader ? <View style={styles.listHeader}>{listHeader}</View> : null}
    </View>
  );

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

        <FlatList
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          data={data}
          initialNumToRender={initialNumToRender}
          ItemSeparatorComponent={ListItemSeparator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={keyExtractor}
          ListEmptyComponent={toListElement(listEmpty)}
          ListFooterComponent={toListElement(listFooter)}
          ListHeaderComponent={header}
          maxToRenderPerBatch={maxToRenderPerBatch}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          onRefresh={onRefresh}
          refreshing={refreshing}
          removeClippedSubviews={Platform.OS === "android"}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          updateCellsBatchingPeriod={updateCellsBatchingPeriod}
          windowSize={windowSize}
        />

        {overlay}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function ListItemSeparator(): ReactElement {
  return <View style={styles.itemSeparator} />;
}

function toListElement(value: ReactNode): ReactElement | null {
  return value ? <>{value}</> : null;
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
  list: {
    flex: 1
  },
  content: {
    padding: spacing.md
  },
  headerStack: {
    gap: spacing.lg,
    paddingBottom: spacing.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
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
  listHeader: {
    gap: spacing.lg
  },
  itemSeparator: {
    height: spacing.md
  }
});
