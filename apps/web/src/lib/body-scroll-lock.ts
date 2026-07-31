"use client";

import { useEffect } from "react";

type SavedScrollLockState = {
  bodyOverflow: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  scrollX: number;
  scrollY: number;
};

let lockCount = 0;
let savedState: SavedScrollLockState | null = null;

export function acquireBodyScrollLock(): () => void {
  lockCount += 1;

  if (lockCount === 1) {
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    savedState = {
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount !== 0 || !savedState) return;

    const state = savedState;
    savedState = null;
    document.body.style.overflow = state.bodyOverflow;
    document.body.style.paddingRight = state.bodyPaddingRight;
    document.documentElement.style.overflow = state.htmlOverflow;
    document.documentElement.style.overscrollBehavior = state.htmlOverscrollBehavior;

    if (Math.abs(window.scrollX - state.scrollX) > 1 || Math.abs(window.scrollY - state.scrollY) > 1) {
      window.scrollTo({ left: state.scrollX, top: state.scrollY, behavior: "instant" });
    }
  };
}

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    return acquireBodyScrollLock();
  }, [locked]);
}

export function resetBodyScrollLockForTests(): void {
  lockCount = 0;
  savedState = null;
}
