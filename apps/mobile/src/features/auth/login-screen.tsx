import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { startMobileConversationForListing } from "../messages/messages-api";
import { saveMobileFavorite } from "../favorites/favorites-api";
import { addMobileCartItem } from "../basket/basket-api";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "./auth-session";
import {
  clearPendingMobileLoginIntent,
  getPendingMobileLoginIntent,
  setPendingMobileLoginIntent,
  type MobilePendingLoginIntent,
  type MobilePostLoginAction
} from "./mobile-login-intent";
import { buildMobilePostLoginRedirectPath } from "./mobile-login-redirect-model";

type LoginParams = {
  postLoginAction?: string | string[];
  redirectTo?: string | string[];
};

export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<LoginParams>();
  const authSession = useAuthSession();

  const [email, setEmail] = useState("demo@babyloop.local");
  const [password, setPassword] = useState("Password123!");
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const postLoginActionParam = firstParam(params.postLoginAction);
  const redirectToParam = firstParam(params.redirectTo);
  const [pendingLoginIntent, setPendingLoginIntentState] = useState<MobilePendingLoginIntent | null>(() =>
    resolveMobileLoginIntentFromValues(postLoginActionParam, redirectToParam)
  );

  const fallbackRedirectPath = buildMobilePostLoginRedirectPath(params);
  const isMfaRequired = authSession.status === "mfa_required" && authSession.mfaChallenge;

  useEffect(() => {
    let active = true;
    const queryIntent = resolveMobileLoginIntentFromValues(postLoginActionParam, redirectToParam);

    if (queryIntent) {
      setPendingMobileLoginIntent(queryIntent);
      setPendingLoginIntentState((currentIntent) =>
        isSameMobileLoginIntent(currentIntent, queryIntent) ? currentIntent : queryIntent
      );
      return;
    }

    void getPendingMobileLoginIntent().then((storedIntent) => {
      if (!active || !storedIntent) {
        return;
      }

      setPendingLoginIntentState((currentIntent) =>
        isSameMobileLoginIntent(currentIntent, storedIntent) ? currentIntent : storedIntent
      );
    });

    return () => {
      active = false;
    };
  }, [postLoginActionParam, redirectToParam]);

  async function handleLogin() {
    setSubmitting(true);
    setActionMessage(null);

    try {
      const ok = await authSession.login({
        email: email.trim(),
        password
      });

      if (ok) {
        await completePostLoginNavigation();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyMfa() {
    setSubmitting(true);
    setActionMessage(null);

    try {
      const ok = await authSession.verifyMfa(otpCode);

      if (ok) {
        setOtpCode("");
        await completePostLoginNavigation();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function completePostLoginNavigation() {
    const intent =
      pendingLoginIntent ??
      resolveMobileLoginIntentFromValues(postLoginActionParam, redirectToParam) ??
      await getPendingMobileLoginIntent();

    if (!intent) {
      router.replace(fallbackRedirectPath);
      return;
    }

    const listingPath = `/listing/${encodeURIComponent(intent.listingId)}`;

    try {
      if (intent.action === "favorite") {
        await saveMobileFavorite(intent.listingId, true);
        clearPendingMobileLoginIntent();
        router.replace(listingPath);
        return;
      }

      if (intent.action === "message") {
        const conversation = await startMobileConversationForListing(intent.listingId);
        clearPendingMobileLoginIntent();
        router.replace(`/conversation/${encodeURIComponent(conversation.id)}`);
        return;
      }

      if (intent.action === "cart") {
        await addMobileCartItem(intent.listingId);
        clearPendingMobileLoginIntent();
        router.replace(listingPath);
        return;
      }
    } catch (error) {
      clearPendingMobileLoginIntent();
      setActionMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
      router.replace(listingPath);
      return;
    }

    clearPendingMobileLoginIntent();
    router.replace(listingPath);
  }

  const title = isMfaRequired ? "OTP doğrulaması" : "Hesabına giriş yap";
  const subtitle = pendingLoginIntent
    ? getIntentSubtitle(pendingLoginIntent.action)
    : isMfaRequired
      ? "Hesabın için e-posta OTP doğrulaması gerekiyor."
      : "Favoriler, mesajlar ve ilan yönetimi için BabyLoop hesabını kullan.";

  return (
    <Screen eyebrow="Hesap" title={title} subtitle={subtitle}>
      <View style={styles.card}>
        {isMfaRequired ? (
          <>
            <Text style={styles.label}>OTP kodu</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="number-pad"
              onChangeText={setOtpCode}
              placeholder="6 haneli kod"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              value={otpCode}
            />

            <Pressable
              disabled={submitting}
              onPress={() => void handleVerifyMfa()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed || submitting ? styles.pressed : null
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "Doğrulanıyor..." : "Devam et"}
              </Text>
            </Pressable>

            <Pressable
              disabled={submitting}
              onPress={authSession.cancelMfa}
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
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="ornek@babyloop.local"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Şifre</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Şifre"
              placeholderTextColor={colors.subtle}
              secureTextEntry
              style={styles.input}
              value={password}
            />

            <Pressable
              disabled={submitting}
              onPress={() => void handleLogin()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed || submitting ? styles.pressed : null
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
              </Text>
            </Pressable>

            <Pressable
              disabled={submitting}
              onPress={() => router.push("/register")}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed || submitting ? styles.pressed : null
              ]}
            >
              <Text style={styles.secondaryButtonText}>Yeni hesap oluştur</Text>
            </Pressable>
          </>
        )}

        {authSession.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{authSession.error}</Text>
          </View>
        ) : null}

        {actionMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionMessage}</Text>
          </View>
        ) : null}

        <Paragraph>
          {pendingLoginIntent
            ? "Girişten sonra kaldığın ilan aksiyonuna devam edeceğiz."
            : "Oturum tokenı cihazda SecureStore ile saklanır; düz AsyncStorage kullanılmaz."}
        </Paragraph>
      </View>
    </Screen>
  );
}

function resolveMobileLoginIntentFromValues(
  postLoginAction: string | null,
  redirectTo: string | null
): MobilePendingLoginIntent | null {
  const action = normalizePostLoginAction(postLoginAction);

  if (!action || !redirectTo) {
    return null;
  }

  const listingId = extractListingIdFromRedirectPath(redirectTo);

  if (!listingId) {
    return null;
  }

  return {
    action,
    listingId
  };
}

function isSameMobileLoginIntent(
  left: MobilePendingLoginIntent | null,
  right: MobilePendingLoginIntent | null
): boolean {
  return left?.action === right?.action && left?.listingId === right?.listingId;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

function normalizePostLoginAction(value: string | null): MobilePostLoginAction | null {
  if (value === "favorite" || value === "message" || value === "cart") {
    return value;
  }

  return null;
}

function extractListingIdFromRedirectPath(value: string): string | null {
  const match = /^\/listing\/([^/?#]+)/u.exec(value);

  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function getIntentSubtitle(action: MobilePostLoginAction): string {
  if (action === "favorite") {
    return "Girişten sonra bu ilanı favorilerine ekleyeceğiz.";
  }

  if (action === "message") {
    return "Girişten sonra satıcıyla konuşmanı başlatacağız.";
  }

  return "Girişten sonra bu ilanı sepete ekleyeceğiz.";
}

const styles = StyleSheet.create({
  card: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "center",
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
  }
});
