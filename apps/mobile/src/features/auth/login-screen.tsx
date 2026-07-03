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
  const [otpCode, setOtpCode] = useState("");
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

  async function handleVerifyMfa() {
    setSubmitting(true);

    try {
      const ok = await authSession.verifyMfa(otpCode);

      if (ok) {
        setOtpCode("");
        router.replace("/account");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isMfaRequired = authSession.status === "mfa_required" && authSession.mfaChallenge;

  return (
    <Screen
      eyebrow="Auth"
      hasTabBar={false}
      title={isMfaRequired ? "OTP doğrulaması" : "Hesabına giriş yap"}
      subtitle={
        isMfaRequired
          ? "Hesabın için e-posta OTP doğrulaması gerekiyor."
          : "Favoriler, mesajlar ve ilan yönetimi için BabyLoop hesabını kullan."
      }
    >
      <View style={styles.card}>
        {isMfaRequired ? (
          <>
            <Text style={styles.mfaTitle}>E-postana gönderilen 6 haneli kodu gir</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setOtpCode(value.replace(/\\D/gu, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              value={otpCode}
            />

            <Pressable
              disabled={submitting || otpCode.length !== 6}
              onPress={handleVerifyMfa}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed || submitting || otpCode.length !== 6 ? styles.pressed : null
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "Doğrulanıyor..." : "OTP kodunu doğrula"}
              </Text>
            </Pressable>

            <Pressable
              disabled={submitting}
              onPress={() => {
                setOtpCode("");
                authSession.cancelMfa();
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed || submitting ? styles.pressed : null
              ]}
            >
              <Text style={styles.secondaryButtonText}>Girişe geri dön</Text>
            </Pressable>
          </>
        ) : (
          <>
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
          </>
        )}

        {authSession.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{authSession.error}</Text>
          </View>
        ) : null}

        <Paragraph>
          {isMfaRequired
            ? "OTP kodu kısa süre geçerlidir. Kod hatalıysa yeniden giriş deneyerek yeni kod isteyebilirsin."
            : "Oturum tokenı cihazda SecureStore ile saklanır; düz AsyncStorage kullanılmaz."}
        </Paragraph>
      </View>

      {!isMfaRequired ? (
        <Link href="/register" style={styles.link}>
          Hesap oluştur
        </Link>
      ) : null}

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
  mfaTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22
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
  secondaryButton: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.primaryDark,
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
