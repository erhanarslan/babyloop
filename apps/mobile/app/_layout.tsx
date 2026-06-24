import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthSessionProvider } from "../src/features/auth/auth-session";

export default function RootLayout() {
  return (
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
  );
}
