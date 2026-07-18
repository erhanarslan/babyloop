import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { colors } from "../../ui/theme";

type MobilePublicationWaitIndicatorProps = {
  label?: string;
};

export function MobilePublicationWaitIndicator({
  label = "Onay bekliyor",
}: MobilePublicationWaitIndicatorProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const turnAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          toValue: 0.5,
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(progress, {
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(300),
      ]),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 700,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 700,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    turnAnimation.start();
    pulseAnimation.start();

    return () => {
      turnAnimation.stop();
      pulseAnimation.stop();
    };
  }, [progress, pulse]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.42],
  });
  const fillingOpacity = progress.interpolate({
    inputRange: [0, 0.42, 0.5, 0.92, 1],
    outputRange: [1, 0.15, 0, 0.15, 1],
  });
  const emptiedOpacity = progress.interpolate({
    inputRange: [0, 0.42, 0.5, 0.92, 1],
    outputRange: [0, 0.85, 1, 0.85, 0],
  });

  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={styles.root}>
      <Animated.View
        style={[
          styles.pulse,
          {
            opacity: pulseOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View style={[styles.iconStage, { transform: [{ rotate }, { scale }] }]}>
        <Animated.Text style={[styles.icon, { opacity: fillingOpacity }]}>⌛</Animated.Text>
        <Animated.Text style={[styles.icon, styles.iconOverlay, { opacity: emptiedOpacity }]}>
          ⏳
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f4c66d",
    backgroundColor: "#fff8e8",
    overflow: "visible",
  },
  pulse: {
    position: "absolute",
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 999,
    backgroundColor: "#f59e0b",
  },
  iconStage: {
    width: 24,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    color: colors.primaryDark,
    fontSize: 20,
  },
  iconOverlay: {
    position: "absolute",
  },
});
