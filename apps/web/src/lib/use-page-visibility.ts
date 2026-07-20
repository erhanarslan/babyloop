"use client";

import { useSyncExternalStore } from "react";

type VisibilityListener = () => void;

const listeners = new Set<VisibilityListener>();
let isDocumentListenerAttached = false;

function getSnapshot(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

function subscribe(listener: VisibilityListener): () => void {
  listeners.add(listener);

  if (typeof document !== "undefined" && !isDocumentListenerAttached) {
    document.addEventListener("visibilitychange", emitVisibilityChange);
    isDocumentListenerAttached = true;
  }

  return () => {
    listeners.delete(listener);

    if (
      typeof document !== "undefined" &&
      isDocumentListenerAttached &&
      listeners.size === 0
    ) {
      document.removeEventListener("visibilitychange", emitVisibilityChange);
      isDocumentListenerAttached = false;
    }
  };
}

function emitVisibilityChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function usePageVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
