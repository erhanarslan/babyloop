import { Link } from "expo-router";
import { StyleSheet } from "react-native";
import { Paragraph, Screen } from "../../ui/screen";

export function LoginScreen() {
  return (
    <Screen eyebrow="Auth" title="Giriş yap">
      <Paragraph>
        Mobil auth shell hazır. Token/cookie stratejisi API-backed auth paketinde netleştirilecek.
      </Paragraph>

      <Paragraph>
        Güvenlik kuralı: mobile token plain AsyncStorage içinde tutulmayacak.
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
