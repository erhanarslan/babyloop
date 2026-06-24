import { Text, View } from "react-native";

import { Screen } from "./screen";

const placeholderColors = {
  text: "#2f2521",
  muted: "#6d5d56",
} as const;

type MobilePlaceholderScreenProps = {
  title: string;
  description: string;
};

export function MobilePlaceholderScreen({
  title,
  description,
}: MobilePlaceholderScreenProps) {
  return (
    <Screen title={title}>
      <View
        style={{
          gap: 12,
          paddingVertical: 24,
        }}
      >
        <Text
          style={{
            color: placeholderColors.text,
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: placeholderColors.muted,
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {description}
        </Text>
      </View>
    </Screen>
  );
}
