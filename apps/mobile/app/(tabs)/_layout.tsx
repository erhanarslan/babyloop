import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
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

const tabColors = {
  active: "#d45d3f",
  inactive: "#7b8794",
  border: "#f1d8ca",
  surface: "#ffffff",
  shadow: "#d45d3f"
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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const navigationVisibility = useAndroidNavigationBarVisibility() ?? "hidden";

  useEffect(() => {
    if (Platform.OS !== "android" || navigationVisibility !== "visible") {
      return;
    }

    const timeoutId = setTimeout(() => {
      void hideAndroidNavigationBar();
    }, 1400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [navigationVisibility]);

  const bottomInset = getMobileTabBarBottomOffset({
    androidNavigationVisibility: navigationVisibility,
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
          elevation: 10
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800"
        },
        sceneStyle: {
          backgroundColor: "#fff7f2"
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
        name="favorites"
        options={{
          title: "Favoriler",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "heart" : "heart-outline"} />
          )
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: "İlan Ver",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "add-circle" : "add-circle-outline"} />
          )
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
        name="messages"
        options={{
          title: "Mesajlar",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} />
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
        name="my-listings"
        options={{
          href: null,
          title: "İlanlarım"
        }}
      />

      <Tabs.Screen
        name="listing/[listingId]"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}
