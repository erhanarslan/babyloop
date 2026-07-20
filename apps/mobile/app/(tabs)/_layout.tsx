import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  hideAndroidNavigationBar,
  useAndroidNavigationBarVisibility
} from "../../src/lib/android-navigation-bar";
import {
  getMobileTabBarBottomOffset,
  MOBILE_TAB_BAR_HEIGHT,
  MOBILE_TAB_BAR_HORIZONTAL_MARGIN,
  MOBILE_TAB_BAR_RADIUS
} from "../../src/ui/mobile-layout";
import { useMobileConversationList } from "../../src/features/messages/conversation-list-store";
import {
  getMobileMessagesTabBadgeLabel
} from "../../src/features/messages/messages-tab-badge-model";
import { colors } from "../../src/ui/theme";

const tabColors = {
  active: colors.primary,
  inactive: "#7b8794",
  border: colors.border,
  surface: colors.surface,
  shadow: colors.primary
} as const;

type TabIconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  color,
  focused
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
}) {
  return (
    <Ionicons
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no"
      name={name}
      size={focused ? 24 : 22}
    />
  );
}

function SellTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.sellTabIcon, focused ? styles.sellTabIconFocused : null]}>
      <Ionicons
        accessibilityElementsHidden
        color="#ffffff"
        importantForAccessibility="no"
        name="add"
        size={29}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const navigationVisibility = useAndroidNavigationBarVisibility() ?? "hidden";
  const [keyboardInsetLocked, setKeyboardInsetLocked] = useState(false);
  const keyboardInsetLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversationList = useMobileConversationList();
  const messagesTabBadge = getMobileMessagesTabBadgeLabel(conversationList.conversations);

  useEffect(() => {
    if (Platform.OS !== "android" || navigationVisibility !== "visible") {
      return;
    }

    const timeoutId = setTimeout(() => {
      void hideAndroidNavigationBar();
    }, keyboardInsetLocked ? 40 : 1400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [keyboardInsetLocked, navigationVisibility]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      if (keyboardInsetLockTimeoutRef.current) {
        clearTimeout(keyboardInsetLockTimeoutRef.current);
        keyboardInsetLockTimeoutRef.current = null;
      }

      setKeyboardInsetLocked(true);
      void hideAndroidNavigationBar();
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      if (keyboardInsetLockTimeoutRef.current) {
        clearTimeout(keyboardInsetLockTimeoutRef.current);
      }

      setKeyboardInsetLocked(true);
      void hideAndroidNavigationBar();

      keyboardInsetLockTimeoutRef.current = setTimeout(() => {
        setKeyboardInsetLocked(false);
        keyboardInsetLockTimeoutRef.current = null;
      }, 420);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();

      if (keyboardInsetLockTimeoutRef.current) {
        clearTimeout(keyboardInsetLockTimeoutRef.current);
        keyboardInsetLockTimeoutRef.current = null;
      }
    };
  }, []);

  const effectiveNavigationVisibility = keyboardInsetLocked ? "hidden" : navigationVisibility;
  const bottomInset = getMobileTabBarBottomOffset({
    androidNavigationVisibility: effectiveNavigationVisibility,
    platformOS: Platform.OS,
    safeAreaBottom: insets.bottom
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabColors.active,
        tabBarInactiveTintColor: tabColors.inactive,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: MOBILE_TAB_BAR_HORIZONTAL_MARGIN,
          right: MOBILE_TAB_BAR_HORIZONTAL_MARGIN,
          bottom: bottomInset,
          height: MOBILE_TAB_BAR_HEIGHT,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: tabColors.border,
          borderRadius: MOBILE_TAB_BAR_RADIUS,
          backgroundColor: tabColors.surface,
          paddingBottom: 7,
          paddingTop: 7,
          shadowColor: tabColors.shadow,
          shadowOpacity: 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
          overflow: "visible"
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800"
        },
        tabBarItemStyle: {
          paddingVertical: 4
        },
        sceneStyle: {
          backgroundColor: colors.background
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "home" : "home-outline"} />
          )
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Mesajlar",
          tabBarBadge: messagesTabBadge,
          tabBarBadgeStyle: {
            backgroundColor: "#ef4444",
            color: "#fff",
            fontSize: 10,
            fontWeight: "900"
          },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} />
          )
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: "İlan ver",
          tabBarIcon: ({ focused }) => <SellTabIcon focused={focused} />,
          tabBarIconStyle: {
            overflow: "visible"
          },
          tabBarItemStyle: {
            overflow: "visible",
            paddingVertical: 0
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "900",
            marginTop: -3
          }
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          title: "Sepetim",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "basket" : "basket-outline"} />
          )
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Hesabım",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "person-circle" : "person-circle-outline"} />
          )
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: "Favoriler"
        }}
      />
      <Tabs.Screen
        name="my-listings"
        options={{
          href: null,
          title: "İlanlarım"
        }}
      />

      <Tabs.Screen
        name="login"
        options={{
          href: null
        }}
      />

      <Tabs.Screen
        name="listing/[listingId]"
        options={{
          href: null
        }}
      />

      <Tabs.Screen
        name="edit-listing/[listingId]"
        options={{
          href: null,
          title: "İlanı düzenle"
        }}
      />

      <Tabs.Screen
        name="conversation/[conversationId]"
        options={{
          href: null,
          title: "Konuşma"
        }}
      />
      <Tabs.Screen
        name="child-profile"
        options={{
          href: null,
          title: "Çocuğum"
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "Bildirimler"
        }}
      />
      <Tabs.Screen
        name="notification-preferences"
        options={{
          href: null,
          title: "Hatırlatıcılar"
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          href: null,
          title: "Güvenlik"
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          href: null,
          title: "Asistan"
        }}
      />

    </Tabs>
  );
}

const styles = StyleSheet.create({
  sellTabIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    marginTop: -14,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: 24,
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.24,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9
  },
  sellTabIconFocused: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 1.06 }]
  }
});
