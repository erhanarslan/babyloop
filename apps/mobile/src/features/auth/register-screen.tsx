import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, shadows } from "../../ui/theme";
import { Paragraph, Screen } from "../../ui/screen";
import { useAuthSession } from "./auth-session";

export function RegisterScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [displayName, setDisplayName] = useState("Demo Parent");
  const [locationCity, setLocationCity] = useState("İstanbul");
  const [email, setEmail] = useState(`demo-${Date.now()}@babyloop.local`);
  const [password, setPassword] = useState("Password123!");
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setSubmitting(true);

    try {
      const ok = await authSession.register({
        displayName: displayName.trim(),
        email: email.trim(),
        locationCity: locationCity.trim(),
        password
      });

      if (ok) {
        router.replace("/account");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      eyebrow="Yeni hesap"
      title="BabyLoop hesabını oluştur"
      subtitle="Favoriler, mesajlar ve ilan yönetimi için sade bir hesap oluştur."
    >
      <View style={styles.card}>
        <TextInput
          onChangeText={setDisplayName}
          placeholder="Adın"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={displayName}
        />

        <TextInput
          onChangeText={setLocationCity}
          placeholder="Şehir"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={locationCity}
        />

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={email}
        />

        <TextInput
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor={colors.subtle}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          disabled={submitting}
          onPress={handleRegister}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed || submitting ? styles.pressed : null
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Hesap oluşturuluyor..." : "Hesap oluştur"}
          </Text>
        </Pressable>

        {authSession.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{authSession.error}</Text>
          </View>
        ) : null}

        <Paragraph>
          Hesabın favorilerini, mesajlarını ve ilanlarını tek yerde takip etmek için kullanılır.
        </Paragraph>
      </View>

      <Link href="/login" style={styles.link}>
        Zaten hesabım var
      </Link>

      <Link href="/" style={styles.linkSecondary}>
        Keşfe dön
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.75
  },
  errorBox: {
    borderRadius: radius.md,
    backgroundColor: "#fff0ed",
    padding: 12
  },
  errorText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
    paddingVertical: 6
  },
  linkSecondary: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800",
    paddingVertical: 4
  }
});
