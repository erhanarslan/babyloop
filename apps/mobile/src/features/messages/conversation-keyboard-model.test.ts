import {
  MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP,
  MOBILE_CONVERSATION_COMPOSER_RESERVED_HEIGHT,
  MOBILE_CONVERSATION_COMPOSER_TAB_GAP,
  getMobileConversationComposerBottomOffset,
  getMobileConversationMessageListBottomPadding,
  getMobileConversationRawAndroidKeyboardBottomOffset,
  getMobileConversationStableAndroidKeyboardBottomOffset,
  getMobileConversationViewportKeyboardOverlap,
  isMobileConversationKeyboardVisible
} from "./conversation-keyboard-model";
import { MOBILE_TAB_BAR_HEIGHT } from "../../ui/mobile-layout";

describe("mobile conversation keyboard model", () => {
  it("keeps the composer above the tab bar when the keyboard is hidden", () => {
    const composerOffset = getMobileConversationComposerBottomOffset({
      androidKeyboardBottomOffset: 0,
      keyboardVisible: false,
      platformOS: "android"
    });

    expect(isMobileConversationKeyboardVisible(0)).toBe(false);
    expect(composerOffset).toBe(MOBILE_TAB_BAR_HEIGHT + MOBILE_CONVERSATION_COMPOSER_TAB_GAP);
    expect(getMobileConversationMessageListBottomPadding(composerOffset)).toBe(
      MOBILE_TAB_BAR_HEIGHT +
        MOBILE_CONVERSATION_COMPOSER_TAB_GAP +
        MOBILE_CONVERSATION_COMPOSER_RESERVED_HEIGHT
    );
  });

  it("keeps the Android composer above the visible keyboard after viewport resize", () => {
    const viewportOverlap = getMobileConversationViewportKeyboardOverlap({
      keyboardHeight: 336,
      platformOS: "android",
      rootLayoutBaselineHeight: 800,
      rootLayoutCurrentHeight: 560
    });
    const rawOffset = getMobileConversationRawAndroidKeyboardBottomOffset({
      keyboardHeight: 336,
      viewportKeyboardOverlap: viewportOverlap
    });
    const composerOffset = getMobileConversationComposerBottomOffset({
      androidKeyboardBottomOffset: rawOffset,
      keyboardVisible: true,
      platformOS: "android"
    });

    expect(viewportOverlap).toBe(240);
    expect(rawOffset).toBe(96);
    expect(composerOffset).toBe(96 + MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP);
  });

  it("uses the stable Android keyboard offset when the raw offset jumps too far", () => {
    expect(getMobileConversationStableAndroidKeyboardBottomOffset({
      rawAndroidKeyboardBottomOffset: 330,
      stableAndroidKeyboardBottomOffset: 96
    })).toBe(96);

    expect(getMobileConversationStableAndroidKeyboardBottomOffset({
      rawAndroidKeyboardBottomOffset: 108,
      stableAndroidKeyboardBottomOffset: 96
    })).toBe(108);
  });

  it("uses a fixed iOS composer keyboard gap and preserves message list padding", () => {
    const composerOffset = getMobileConversationComposerBottomOffset({
      androidKeyboardBottomOffset: 999,
      keyboardVisible: true,
      platformOS: "ios"
    });

    expect(composerOffset).toBe(MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP);
    expect(getMobileConversationMessageListBottomPadding(composerOffset)).toBe(
      MOBILE_CONVERSATION_COMPOSER_KEYBOARD_GAP + MOBILE_CONVERSATION_COMPOSER_RESERVED_HEIGHT
    );
  });
});
