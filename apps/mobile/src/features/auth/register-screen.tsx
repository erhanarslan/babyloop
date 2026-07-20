import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { buildWebUrl } from "../../config/web";
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
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleRegister() {
    if (!termsAccepted) {
      return;
    }

    setSubmitting(true);

    try {
      const ok = await authSession.register({
        displayName: displayName.trim(),
        email: email.trim(),
        locationCity: locationCity.trim(),
        password,
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION
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
      hasTabBar={false}
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

        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            Kayıt, güvenlik ve pazaryeri süreçleri için verilerin işlenir. KVKK aydınlatması açık rıza talebi değildir.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => void Linking.openURL(buildWebUrl("/legal/kvkk"))}>
              <Text style={styles.legalLink}>KVKK Aydınlatma Metni</Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(buildWebUrl("/legal/privacy"))}>
              <Text style={styles.legalLink}>Gizlilik Politikası</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
            onPress={() => setTermsAccepted((value) => !value)}
            style={styles.termsRow}
          >
            <View style={[styles.checkbox, termsAccepted ? styles.checkboxChecked : null]}>
              <Text style={styles.checkboxMark}>{termsAccepted ? "✓" : ""}</Text>
            </View>
            <Text style={styles.termsText}>
              Kullanım Koşulları'nı (sürüm {CURRENT_TERMS_VERSION}) okudum ve kabul ediyorum.
            </Text>
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(buildWebUrl("/legal/terms"))}>
            <Text style={styles.legalLink}>Kullanım Koşulları'nı aç</Text>
          </Pressable>
        </View>

        <Pressable
          disabled={submitting || !termsAccepted}
          onPress={handleRegister}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed || submitting || !termsAccepted ? styles.pressed : null
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
  legalBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: 13,
    gap: 10
  },
  legalText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  legalLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  checkboxMark: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "900"
  },
  termsText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.75
  },
  errorBox: {
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
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
