import * as NavigationBar from "expo-navigation-bar";
import { Platform } from "react-native";

export async function hideAndroidNavigationBar(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  await NavigationBar.setBehaviorAsync("inset-swipe").catch(() => undefined);
  await NavigationBar.setButtonStyleAsync("dark").catch(() => undefined);
  await NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
}

export function useAndroidNavigationBarVisibility() {
  const visibility = NavigationBar.useVisibility();

  if (Platform.OS !== "android") {
    return "hidden";
  }

  return visibility;
}
