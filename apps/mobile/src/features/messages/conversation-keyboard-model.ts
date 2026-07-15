import { MOBILE_TAB_BAR_HEIGHT } from "../../ui/mobile-layout";

export type MobileConversationKeyboardPlatform = "android" | "ios" | "web" | string;

export const MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP = 52;
export const MOBILE_CONVERSATION_COMPOSER_TAB_GAP = 8;
export const MOBILE_CONVERSATION_COMPOSER_RESERVED_HEIGHT = 86;
export const MOBILE_CONVERSATION_KEYBOARD_OFFSET_JUMP_TOLERANCE = 16;
export const MOBILE_CONVERSATION_KEYBOARD_STABLE_OFFSET_DELAY_MS = 220;

export function isMobileConversationKeyboardVisible(keyboardHeight: number): boolean {
  return Math.max(0, keyboardHeight) > 0;
}

export function getMobileConversationViewportKeyboardOverlap(input: {
  keyboardHeight: number;
  platformOS: MobileConversationKeyboardPlatform;
  rootLayoutBaselineHeight: number;
  rootLayoutCurrentHeight: number;
}): number {
  if (input.platformOS !== "android" || !isMobileConversationKeyboardVisible(input.keyboardHeight)) {
    return 0;
  }

  return Math.max(0, input.rootLayoutBaselineHeight - input.rootLayoutCurrentHeight);
}

export function getMobileConversationRawAndroidKeyboardBottomOffset(input: {
  keyboardHeight: number;
  viewportKeyboardOverlap: number;
}): number {
  return Math.max(0, input.keyboardHeight - input.viewportKeyboardOverlap);
}

export function getMobileConversationStableAndroidKeyboardBottomOffset(input: {
  rawAndroidKeyboardBottomOffset: number;
  stableAndroidKeyboardBottomOffset: number | null;
}): number {
  const stableOffset = input.stableAndroidKeyboardBottomOffset;

  if (
    stableOffset !== null &&
    input.rawAndroidKeyboardBottomOffset >
      stableOffset + MOBILE_CONVERSATION_KEYBOARD_OFFSET_JUMP_TOLERANCE
  ) {
    return stableOffset;
  }

  return input.rawAndroidKeyboardBottomOffset;
}

export function getMobileConversationComposerBottomOffset(input: {
  androidKeyboardBottomOffset: number;
  keyboardVisible: boolean;
  platformOS: MobileConversationKeyboardPlatform;
}): number {
  if (!input.keyboardVisible) {
    return MOBILE_TAB_BAR_HEIGHT + MOBILE_CONVERSATION_COMPOSER_TAB_GAP;
  }

  if (input.platformOS === "android") {
    return input.androidKeyboardBottomOffset + MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP;
  }

  return MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP;
}

export function getMobileConversationMessageListBottomPadding(composerBottomOffset: number): number {
  return composerBottomOffset + MOBILE_CONVERSATION_COMPOSER_RESERVED_HEIGHT;
}
