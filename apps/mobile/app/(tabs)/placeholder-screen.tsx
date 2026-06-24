import { Text, View } from "react-native";

import { Screen } from "../../src/ui/screen";

const placeholderColors = {
  text: "#0f172a",
  muted: "#64748b",
} as const;

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export default function PlaceholderScreen({
  title,
  description,
}: PlaceholderScreenProps) {
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
            fontWeight: "800",
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
