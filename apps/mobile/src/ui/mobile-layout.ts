export type MobilePlatformOS = "android" | "ios" | "web" | string;
export type AndroidNavigationVisibility = "hidden" | "visible" | string;
export type MobileKeyboardAvoidingBehavior = "height" | "padding" | "position" | undefined;

export const MOBILE_TAB_BAR_HEIGHT = 62;
export const MOBILE_TAB_BAR_HORIZONTAL_MARGIN = 14;
export const MOBILE_TAB_BAR_RADIUS = 28;
export const MOBILE_TAB_BAR_CONTENT_GAP = 14;
export const MOBILE_SCREEN_BASE_BOTTOM_PADDING = 32;

type BottomOffsetInput = {
  androidNavigationVisibility: AndroidNavigationVisibility;
  platformOS: MobilePlatformOS;
  safeAreaBottom: number;
};

export function getAndroidAwareBottomOffset({
  androidNavigationVisibility,
  platformOS,
  safeAreaBottom
}: BottomOffsetInput): number {
  const normalizedSafeAreaBottom = Math.max(0, safeAreaBottom);

  if (platformOS === "android") {
    return androidNavigationVisibility === "visible" ? normalizedSafeAreaBottom : 0;
  }

  return normalizedSafeAreaBottom;
}

export function getMobileTabBarBottomOffset(input: BottomOffsetInput): number {
  return getAndroidAwareBottomOffset(input);
}

export function getMobileScreenContentBottomPadding({
  androidNavigationVisibility,
  hasTabBar = true,
  platformOS,
  safeAreaBottom
}: BottomOffsetInput & {
  hasTabBar?: boolean;
}): number {
  const bottomOffset = getAndroidAwareBottomOffset({
    androidNavigationVisibility,
    platformOS,
    safeAreaBottom
  });

  if (!hasTabBar) {
    return MOBILE_SCREEN_BASE_BOTTOM_PADDING + bottomOffset;
  }

  return MOBILE_TAB_BAR_HEIGHT + MOBILE_TAB_BAR_CONTENT_GAP + bottomOffset;
}

export function getMobileKeyboardAvoidingBehavior(
  platformOS: MobilePlatformOS
): MobileKeyboardAvoidingBehavior {
  if (platformOS === "ios") {
    return "padding";
  }

  if (platformOS === "android") {
    return "height";
  }

  return undefined;
}
