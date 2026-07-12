import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileLoginApprovalPrompt } from "../src/features/auth/mobile-login-approval-prompt";
import { AuthSessionProvider } from "../src/features/auth/auth-session";
import { MobilePushRegistrationBootstrap } from "../src/features/notifications/mobile-push-registration-bootstrap";
import { hideAndroidNavigationBar } from "../src/lib/android-navigation-bar";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    void hideAndroidNavigationBar();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void hideAndroidNavigationBar();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <MobilePushRegistrationBootstrap />
        <MobileLoginApprovalPrompt />
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
