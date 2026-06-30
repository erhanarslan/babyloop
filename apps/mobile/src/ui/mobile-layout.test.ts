import {
  getAndroidAwareBottomOffset,
  getMobileScreenContentBottomPadding,
  getMobileTabBarBottomOffset,
  MOBILE_TAB_BAR_HEIGHT
} from "./mobile-layout";

describe("mobile layout helpers", () => {
  it("uses the full bottom area when Android navigation is hidden", () => {
    expect(
      getMobileTabBarBottomOffset({
        androidNavigationVisibility: "hidden",
        platformOS: "android",
        safeAreaBottom: 34
      })
    ).toBe(0);
  });

  it("pushes the tab bar above Android system navigation when it is visible", () => {
    expect(
      getMobileTabBarBottomOffset({
        androidNavigationVisibility: "visible",
        platformOS: "android",
        safeAreaBottom: 34
      })
    ).toBe(34);
  });

  it("keeps iOS safe-area spacing", () => {
    expect(
      getAndroidAwareBottomOffset({
        androidNavigationVisibility: "hidden",
        platformOS: "ios",
        safeAreaBottom: 21
      })
    ).toBe(21);
  });

  it("reserves enough content space above the floating tab bar", () => {
    expect(
      getMobileScreenContentBottomPadding({
        androidNavigationVisibility: "hidden",
        platformOS: "android",
        safeAreaBottom: 34
      })
    ).toBeGreaterThan(MOBILE_TAB_BAR_HEIGHT);
  });
});
