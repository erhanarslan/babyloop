import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthSessionProvider } from "../src/features/auth/auth-session";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    void NavigationBar.setVisibilityAsync("hidden");
    void NavigationBar.setButtonStyleAsync("dark").catch(() => undefined);
    void NavigationBar.setBackgroundColorAsync("transparent").catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "#fff7f2"
            }
          }}
        />
      </AuthSessionProvider>
    </SafeAreaProvider>
  );
}
