import { Text } from "react-native";

import { Screen } from "./screen";
import { MobileCard } from "./mobile-primitives";
import { colors, spacing } from "./theme";

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
      <MobileCard
        style={{
          gap: spacing.sm
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {description}
        </Text>
      </MobileCard>
    </Screen>
  );
}
