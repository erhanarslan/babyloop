import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, shadows } from "../../ui/theme";
import { Paragraph, Screen } from "../../ui/screen";
import { useAuthSession } from "./auth-session";

export function LoginScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [email, setEmail] = useState("demo@babyloop.local");
  const [password, setPassword] = useState("Password123!");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);

    try {
      const ok = await authSession.login({
        email: email.trim(),
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
      eyebrow="Auth"
      title="Hesabına giriş yap"
      subtitle="Favoriler, mesajlar ve ilan yönetimi için BabyLoop hesabını kullan."
    >
      <View style={styles.card}>
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
          onPress={handleLogin}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed || submitting ? styles.pressed : null
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
          </Text>
        </Pressable>

        {authSession.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{authSession.error}</Text>
          </View>
        ) : null}

        <Paragraph>
          Oturum uygulama açıkken kullanılabilir. Uygulamayı kapatırsan yeniden giriş yapman gerekebilir.
        </Paragraph>
      </View>

      <Link href="/register" style={styles.link}>
        Hesap oluştur
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
