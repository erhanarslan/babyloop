import { Tabs } from "expo-router";
import { Text } from "react-native";

const tabColors = {
  active: "#2563eb",
  inactive: "#64748b",
  border: "#e2e8f0",
} as const;

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ color, fontSize: 18, fontWeight: "700" }}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabColors.active,
        tabBarInactiveTintColor: tabColors.inactive,
        tabBarStyle: {
          borderTopColor: tabColors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color }) => <TabIcon color={color} label="⌂" />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favoriler",
          tabBarIcon: ({ color }) => <TabIcon color={color} label="♡" />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: "İlan Ver",
          tabBarIcon: ({ color }) => <TabIcon color={color} label="+" />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Mesajlar",
          tabBarIcon: ({ color }) => <TabIcon color={color} label="✉" />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Hesabım",
          tabBarIcon: ({ color }) => <TabIcon color={color} label="☻" />,
        }}
      />
    </Tabs>
  );
}
