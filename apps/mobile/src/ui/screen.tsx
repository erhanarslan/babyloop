import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

type ScreenProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
};

export function Screen({ title, eyebrow, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fffaf7"
  },
  content: {
    padding: 20,
    gap: 12
  },
  eyebrow: {
    color: "#9a6b4f",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  title: {
    color: "#2f2521",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  body: {
    gap: 12,
    paddingTop: 8
  },
  paragraph: {
    color: "#5f514b",
    fontSize: 16,
    lineHeight: 23
  }
});
