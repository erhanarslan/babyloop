import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#fffaf7"
          },
          headerTitleStyle: {
            color: "#2f2521",
            fontWeight: "800"
          },
          headerTintColor: "#d45d3f",
          contentStyle: {
            backgroundColor: "#fffaf7"
          }
        }}
      />
    </>
  );
}
