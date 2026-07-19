import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useMobileReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setPrefersReducedMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setPrefersReducedMotion
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return prefersReducedMotion;
}
