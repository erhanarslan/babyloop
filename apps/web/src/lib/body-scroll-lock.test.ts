import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireBodyScrollLock, resetBodyScrollLockForTests } from "./body-scroll-lock";

describe("body scroll lock", () => {
  beforeEach(() => {
    resetBodyScrollLockForTests();
    Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1480 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 980 });
    vi.stubGlobal("scrollTo", vi.fn());
    document.body.style.cssText = "overflow: clip; padding-right: 3px";
    document.documentElement.style.cssText = "overflow: auto; overscroll-behavior: contain";
  });

  afterEach(() => vi.restoreAllMocks());

  it("locks without changing the captured scroll position and restores inline styles", () => {
    const release = acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.paddingRight).toBe("20px");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    expect(window.scrollY).toBe(1480);
    release();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.body.style.paddingRight).toBe("3px");
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.documentElement.style.overscrollBehavior).toBe("contain");
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps nested overlays locked until the final release", () => {
    const releaseFirst = acquireBodyScrollLock();
    const releaseSecond = acquireBodyScrollLock();
    releaseFirst();
    expect(document.body.style.overflow).toBe("hidden");
    releaseSecond();
    expect(document.body.style.overflow).toBe("clip");
  });
});
