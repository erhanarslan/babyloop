import { Link } from "expo-router";
import { StyleSheet } from "react-native";
import { Paragraph, Screen } from "../../ui/screen";

export function AccountScreen() {
  return (
    <Screen eyebrow="Hesap" title="Hesabım">
      <Paragraph>
        Hesap shell hazır. Bu alan auth/me, favoriler, mesajlar ve çocuk profili linkleriyle genişletilecek.
      </Paragraph>

      <Link href="/" style={styles.link}>
        Keşfe dön
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: "#d45d3f",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 6
  }
});
