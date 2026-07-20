import { useFocusEffect, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/auth-session";
import { addMobileAuthSessionsRefreshListener } from "../../src/features/auth/auth-session-events";
import {
  changeMobilePassword,
  confirmMobileAccountDeletion,
  disableMobileLoginApproval,
  disableMobileMfa,
  enableMobileLoginApproval,
  enableMobileMfa,
  fetchMobileAuthSessions,
  fetchMobileLoginApprovalStatus,
  fetchMobileMfaStatus,
  requestMobileAccountDeletion,
  revokeMobileAuthSession,
  type MobileAuthSession
} from "../../src/features/auth/auth-api";
import {
  buildMobileSensitiveToggleDescription,
  buildMobileSensitiveToggleTitle,
  canSubmitMobileSensitiveTogglePassword,
  getMobileAccountDeletionErrorMessage,
  getMobileSecurityRows,
  MOBILE_ACCOUNT_DELETION_CONFIRMATION,
  normalizeMobileAccountDeletionCode,
  validateMobileAccountDeletionConfirmation,
  validateMobilePasswordChangeForm,
  type MobilePasswordChangeForm,
  type MobileSecurityRowTone,
  type MobileSensitiveSecurityToggleState,
  type MobileSensitiveSecurityToggleTarget
} from "../../src/features/security/security-model";
import { buildMobileSessionCards } from "../../src/features/security/mobile-session-model";
import { MobileButton, MobileCard } from "../../src/ui/mobile-primitives";
import { Screen } from "../../src/ui/screen";
import { colors, radius, spacing } from "../../src/ui/theme";

export default function SecurityRoute() {
  const router = useRouter();
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [sensitiveToggle, setSensitiveToggle] = useState<MobileSensitiveSecurityToggleState | null>(null);
  const [sensitiveTogglePassword, setSensitiveTogglePassword] = useState("");
  const [sensitiveToggleError, setSensitiveToggleError] = useState<string | null>(null);
  const [savingSensitiveToggle, setSavingSensitiveToggle] = useState(false);
  const [loadingMfaStatus, setLoadingMfaStatus] = useState(false);
  const [savingMfa, setSavingMfa] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mobileLoginApprovalEnabled, setMobileLoginApprovalEnabled] = useState<boolean | null>(null);
  const [loadingLoginApprovalStatus, setLoadingLoginApprovalStatus] = useState(false);
  const [savingLoginApproval, setSavingLoginApproval] = useState(false);
  const [loginApprovalMessage, setLoginApprovalMessage] = useState<string | null>(null);
  const [loginApprovalError, setLoginApprovalError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<MobileAuthSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState<MobilePasswordChangeForm>({
    confirmPassword: "",
    currentPassword: "",
    newPassword: ""
  });
  const [savingPasswordChange, setSavingPasswordChange] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const [accountDeletionOpen, setAccountDeletionOpen] = useState(false);
  const [accountDeletionStep, setAccountDeletionStep] = useState<"request" | "confirm">("request");
  const [accountDeletionCurrentPassword, setAccountDeletionCurrentPassword] = useState("");
  const [accountDeletionChallengeId, setAccountDeletionChallengeId] = useState<string | null>(null);
  const [accountDeletionCode, setAccountDeletionCode] = useState("");
  const [accountDeletionConfirmation, setAccountDeletionConfirmation] = useState("");
  const [accountDeletionError, setAccountDeletionError] = useState<string | null>(null);
  const [savingAccountDeletion, setSavingAccountDeletion] = useState(false);
  const securityOverviewRefreshRef = useRef<Promise<void> | null>(null);
  const currentSecurityProfileIdRef = useRef(currentUser?.profile.id ?? null);
  currentSecurityProfileIdRef.current = currentUser?.profile.id ?? null;

  useEffect(() => {
    if (currentUser) {
      return;
    }

    setMfaEnabled(null);
    setMobileLoginApprovalEnabled(null);
    setSensitiveToggle(null);
    setSensitiveTogglePassword("");
    setSensitiveToggleError(null);
    setPasswordChangeOpen(false);
    setPasswordChangeForm({
      confirmPassword: "",
      currentPassword: "",
      newPassword: ""
    });
    setPasswordChangeMessage(null);
    setPasswordChangeError(null);
    setAccountDeletionOpen(false);
    setAccountDeletionStep("request");
    setAccountDeletionCurrentPassword("");
    setAccountDeletionChallengeId(null);
    setAccountDeletionCode("");
    setAccountDeletionConfirmation("");
    setAccountDeletionError(null);
    setSavingAccountDeletion(false);
    setLoadingMfaStatus(false);
    setLoadingLoginApprovalStatus(false);
    setLoadingSessions(false);
    setSessions([]);
    setCurrentSessionId(null);
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) {
        return;
      }

      void handleSecurityOverviewRefresh();

      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          void handleSecurityOverviewRefresh({ silent: true });
        }
      });

      return () => subscription.remove();
    }, [currentUser])
  );

  const securityRows = useMemo(
    () => getMobileSecurityRows({
      mfaEnabled,
      mobileLoginApprovalEnabled
    }),
    [mfaEnabled, mobileLoginApprovalEnabled]
  );
  const sessionCards = useMemo(
    () => buildMobileSessionCards(sessions, currentSessionId),
    [sessions, currentSessionId]
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    return addMobileAuthSessionsRefreshListener(() => {
      void handleSessionRefresh({ silent: true });
    });
  }, [currentUser]);

  function openSensitiveToggle(target: MobileSensitiveSecurityToggleTarget, nextEnabled: boolean) {
    setSensitiveToggle({ target, nextEnabled });
    setSensitiveTogglePassword("");
    setSensitiveToggleError(null);

    if (target === "mfa_email_otp") {
      setMfaMessage(null);
      setMfaError(null);
    } else {
      setLoginApprovalMessage(null);
      setLoginApprovalError(null);
    }
  }

  function closeSensitiveToggle() {
    if (savingSensitiveToggle) {
      return;
    }

    setSensitiveToggle(null);
    setSensitiveTogglePassword("");
    setSensitiveToggleError(null);
  }

  async function handleSensitiveToggleSubmit() {
    if (!sensitiveToggle) {
      return;
    }

    if (!canSubmitMobileSensitiveTogglePassword(sensitiveTogglePassword)) {
      setSensitiveToggleError("Mevcut şifren en az 8 karakter olmalı.");
      return;
    }

    const target = sensitiveToggle.target;
    const nextEnabled = sensitiveToggle.nextEnabled;

    setSavingSensitiveToggle(true);
    setSensitiveToggleError(null);

    if (target === "mfa_email_otp") {
      setSavingMfa(true);
      setMfaMessage(null);
      setMfaError(null);
    } else {
      setSavingLoginApproval(true);
      setLoginApprovalMessage(null);
      setLoginApprovalError(null);
    }

    try {
      if (target === "mfa_email_otp") {
        const response = nextEnabled
          ? await enableMobileMfa({ currentPassword: sensitiveTogglePassword })
          : await disableMobileMfa({ currentPassword: sensitiveTogglePassword });

        if (!response.ok) {
          setSensitiveToggleError(response.error.message);
          setMfaError(response.error.message);
          return;
        }

        setMfaEnabled(response.data.mfaEnabled);
        setMfaMessage(
          response.data.mfaEnabled
            ? "OTP/MFA aktif. Bir sonraki girişte e-posta kodu istenecek."
            : "OTP/MFA kapatıldı. Bir sonraki girişte ek kod istenmeyecek."
        );
      } else {
        const response = nextEnabled
          ? await enableMobileLoginApproval({ currentPassword: sensitiveTogglePassword })
          : await disableMobileLoginApproval({ currentPassword: sensitiveTogglePassword });

        if (!response.ok) {
          setSensitiveToggleError(response.error.message);
          setLoginApprovalError(response.error.message);
          return;
        }

        setMobileLoginApprovalEnabled(response.data.mobileLoginApprovalEnabled);
        setLoginApprovalMessage(
          response.data.mobileLoginApprovalEnabled
            ? "Mobil giriş onayı aktif. Web girişleri bu uygulamada onay bekleyecek."
            : "Mobil giriş onayı kapatıldı."
        );
      }

      setSensitiveToggle(null);
      setSensitiveTogglePassword("");
      setSensitiveToggleError(null);
    } finally {
      if (target === "mfa_email_otp") {
        setSavingMfa(false);
      } else {
        setSavingLoginApproval(false);
      }

      setSavingSensitiveToggle(false);
    }
  }

  function openPasswordChange() {
    setPasswordChangeOpen(true);
    setPasswordChangeForm({
      confirmPassword: "",
      currentPassword: "",
      newPassword: ""
    });
    setPasswordChangeMessage(null);
    setPasswordChangeError(null);
  }

  function closePasswordChange() {
    if (savingPasswordChange) {
      return;
    }

    setPasswordChangeOpen(false);
    setPasswordChangeForm({
      confirmPassword: "",
      currentPassword: "",
      newPassword: ""
    });
    setPasswordChangeError(null);
  }

  function updatePasswordChangeField(field: keyof MobilePasswordChangeForm, value: string) {
    setPasswordChangeForm((current) => ({
      ...current,
      [field]: value
    }));
    setPasswordChangeError(null);
  }

  async function handlePasswordChangeSubmit() {
    const validationError = validateMobilePasswordChangeForm(passwordChangeForm);

    if (validationError) {
      setPasswordChangeError(validationError);
      return;
    }

    setSavingPasswordChange(true);
    setPasswordChangeError(null);
    setPasswordChangeMessage(null);

    try {
      const response = await changeMobilePassword({
        currentPassword: passwordChangeForm.currentPassword,
        newPassword: passwordChangeForm.newPassword
      });

      if (!response.ok) {
        setPasswordChangeError(response.error.message);
        return;
      }

      setPasswordChangeOpen(false);
      setPasswordChangeForm({
        confirmPassword: "",
        currentPassword: "",
        newPassword: ""
      });
      setPasswordChangeMessage("Şifren değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.");
      await handleSessionRefresh({ silent: true });
    } finally {
      setSavingPasswordChange(false);
    }
  }

  function openAccountDeletion() {
    setAccountDeletionOpen(true);
    setAccountDeletionStep("request");
    setAccountDeletionCurrentPassword("");
    setAccountDeletionChallengeId(null);
    setAccountDeletionCode("");
    setAccountDeletionConfirmation("");
    setAccountDeletionError(null);
  }

  function closeAccountDeletion() {
    if (savingAccountDeletion) {
      return;
    }

    setAccountDeletionOpen(false);
    setAccountDeletionStep("request");
    setAccountDeletionCurrentPassword("");
    setAccountDeletionChallengeId(null);
    setAccountDeletionCode("");
    setAccountDeletionConfirmation("");
    setAccountDeletionError(null);
  }

  async function handleAccountDeletionRequest() {
    setSavingAccountDeletion(true);
    setAccountDeletionError(null);

    try {
      const response = await requestMobileAccountDeletion({
        ...(accountDeletionCurrentPassword.trim()
          ? { currentPassword: accountDeletionCurrentPassword }
          : {})
      });

      if (!response.ok) {
        setAccountDeletionError(
          getMobileAccountDeletionErrorMessage(
            response.error.code,
            response.error.message
          )
        );
        return;
      }

      setAccountDeletionChallengeId(response.data.challengeId);
      setAccountDeletionStep("confirm");
      setAccountDeletionCurrentPassword("");
    } finally {
      setSavingAccountDeletion(false);
    }
  }

  async function handleAccountDeletionConfirm() {
    const validationError = validateMobileAccountDeletionConfirmation({
      code: accountDeletionCode,
      confirmation: accountDeletionConfirmation
    });

    if (validationError) {
      setAccountDeletionError(validationError);
      return;
    }

    if (!accountDeletionChallengeId) {
      setAccountDeletionError("Hesap silme güvenlik kodunu yeniden iste.");
      setAccountDeletionStep("request");
      return;
    }

    setSavingAccountDeletion(true);
    setAccountDeletionError(null);

    try {
      const response = await confirmMobileAccountDeletion({
        challengeId: accountDeletionChallengeId,
        code: accountDeletionCode,
        confirmation: MOBILE_ACCOUNT_DELETION_CONFIRMATION
      });

      if (!response.ok) {
        setAccountDeletionError(
          getMobileAccountDeletionErrorMessage(
            response.error.code,
            response.error.message
          )
        );
        return;
      }

      await authSession.logout();
      router.replace("/login");
    } finally {
      setSavingAccountDeletion(false);
    }
  }

  function handleSecurityOverviewRefresh(options: { silent?: boolean } = {}): Promise<void> {
    if (securityOverviewRefreshRef.current) {
      return securityOverviewRefreshRef.current;
    }

    const requestProfileId = currentSecurityProfileIdRef.current;

    if (!requestProfileId) {
      return Promise.resolve();
    }

    const task = (async () => {
      const silent = options.silent ?? false;

      if (!silent) {
        setLoadingMfaStatus(true);
        setLoadingLoginApprovalStatus(true);
        setLoadingSessions(true);
        setMfaError(null);
        setLoginApprovalError(null);
        setSessionError(null);
      }

      const [mfaResponse, loginApprovalResponse, sessionsResponse] = await Promise.all([
        fetchMobileMfaStatus(),
        fetchMobileLoginApprovalStatus(),
        fetchMobileAuthSessions()
      ]);

      if (currentSecurityProfileIdRef.current !== requestProfileId) {
        return;
      }

      if (mfaResponse.ok) {
        setMfaEnabled(mfaResponse.data.mfaEnabled);
      } else if (!silent) {
        setMfaEnabled(null);
        setMfaError(mfaResponse.error.message);
      }

      if (loginApprovalResponse.ok) {
        setMobileLoginApprovalEnabled(loginApprovalResponse.data.mobileLoginApprovalEnabled);
      } else if (!silent) {
        setMobileLoginApprovalEnabled(null);
        setLoginApprovalError(loginApprovalResponse.error.message);
      }

      if (sessionsResponse.ok) {
        setSessions(sessionsResponse.data.sessions);
        setCurrentSessionId(sessionsResponse.data.currentSessionId);
      } else if (!silent) {
        setSessions([]);
        setCurrentSessionId(null);
        setSessionError(sessionsResponse.error.message);
      }

      if (!silent) {
        setLoadingMfaStatus(false);
        setLoadingLoginApprovalStatus(false);
        setLoadingSessions(false);
      }
    })();

    securityOverviewRefreshRef.current = task.finally(() => {
      securityOverviewRefreshRef.current = null;
    });

    return securityOverviewRefreshRef.current;
  }

  async function handleSessionRefresh(options: { silent?: boolean } = {}) {
    const requestProfileId = currentSecurityProfileIdRef.current;

    if (!requestProfileId) {
      return;
    }

    const silent = options.silent ?? false;

    if (!silent) {
      setLoadingSessions(true);
      setSessionError(null);
      setSessionMessage(null);
    }

    const response = await fetchMobileAuthSessions();

    if (currentSecurityProfileIdRef.current !== requestProfileId) {
      return;
    }

    if (response.ok) {
      setSessions(response.data.sessions);
      setCurrentSessionId(response.data.currentSessionId);
    } else if (!silent) {
      setMobileLoginApprovalEnabled(null);
      setSensitiveToggle(null);
      setSensitiveTogglePassword("");
      setSensitiveToggleError(null);
      setSessions([]);
      setCurrentSessionId(null);
      setSessionError(response.error.message);
    }

    if (!silent) {
      setLoadingSessions(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingSessionId(sessionId);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const response = await revokeMobileAuthSession(sessionId);

      if (!response.ok) {
        setSessionError(response.error.message);
        return;
      }

      if (response.data.currentSessionRevoked) {
        await authSession.logout();
        router.replace("/login");
        return;
      }

      setSessions((current) => current.filter((session) => session.id !== response.data.sessionId));
      setSessionMessage("Seçili oturum kapatıldı.");
    } finally {
      setRevokingSessionId(null);
    }
  }

  if (!currentUser) {
    return (
      <Screen eyebrow="Hesap" title="Güvenlik">
        <MobileCard style={styles.card}>
          <Text style={styles.title}>Giriş gerekli</Text>
          <Text style={styles.text}>Şifre ve oturum güvenliği ayarları hesabına bağlıdır.</Text>
          <MobileButton onPress={() => router.push("/login")}>Giriş yap</MobileButton>
        </MobileCard>
      </Screen>
    );
  }

  const displayName = currentUser.profile.displayName.trim();
  const greetingTitle = displayName ? `Merhaba, ${displayName}` : "Merhaba";
  const pagePasswordChangeError = passwordChangeOpen ? null : passwordChangeError;

  return (
    <Screen title={greetingTitle}>
      <View style={styles.list}>
        {securityRows.map((row) => (
          <SecurityRow
            action={getSecurityRowAction({
              loadingLoginApprovalStatus,
              loadingMfaStatus,
              mfaEnabled,
              mobileLoginApprovalEnabled,
              openPasswordChange,
              openSensitiveToggle,
              rowTitle: row.title,
              savingLoginApproval,
              savingMfa
            })}
            badge={row.badge}
            key={row.title}
            title={row.title}
            tone={row.tone}
            value={row.value}
          />
        ))}
      </View>

      {passwordChangeMessage || pagePasswordChangeError || mfaMessage || loginApprovalMessage || mfaError || loginApprovalError ? (
        <View style={styles.feedbackList}>
          {passwordChangeMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{passwordChangeMessage}</Text>
            </View>
          ) : null}
          {pagePasswordChangeError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{pagePasswordChangeError}</Text>
            </View>
          ) : null}
          {loginApprovalMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{loginApprovalMessage}</Text>
            </View>
          ) : null}
          {loginApprovalError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loginApprovalError}</Text>
            </View>
          ) : null}
          {mfaMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{mfaMessage}</Text>
            </View>
          ) : null}
          {mfaError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{mfaError}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <MobileCard style={styles.card}>
        <Text style={styles.title}>Aktif cihazlar</Text>

        {loadingSessions ? <Text style={styles.text}>Oturumlar yükleniyor...</Text> : null}

        {sessionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{sessionError}</Text>
          </View>
        ) : null}

        {sessionMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{sessionMessage}</Text>
          </View>
        ) : null}

        {!loadingSessions && sessionCards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aktif cihaz görünmüyor</Text>
            <Text style={styles.text}>Yeniden giriş yaptığında bu cihaz burada listelenir.</Text>
          </View>
        ) : null}

        <View style={styles.sessionList}>
          {sessionCards.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                {session.isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Bu cihaz</Text>
                  </View>
                ) : (
                  <Pressable
                    disabled={revokingSessionId === session.id}
                    onPress={() => void handleRevokeSession(session.id)}
                    style={({ pressed }) => [
                      styles.compactActionButton,
                      pressed || revokingSessionId === session.id ? styles.pressed : null
                    ]}
                  >
                    <Text style={styles.compactActionButtonText}>
                      {revokingSessionId === session.id ? "..." : session.actionLabel}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.sessionMeta}>{session.meta}</Text>
            </View>
          ))}
        </View>

      </MobileCard>

      <MobileCard style={styles.card}>
        <Text style={styles.title}>Hesabı kalıcı olarak sil</Text>
        <Text style={styles.text}>
          Bu işlem geri alınamaz. Çocuk profilleri, favoriler, kayıtlı aramalar ve bildirim
          tercihleri silinir; pazaryeri geçmişindeki zorunlu kayıtlar anonimleştirilir.
        </Text>
        <MobileButton onPress={openAccountDeletion} variant="danger">
          Hesabımı sil
        </MobileButton>
      </MobileCard>

      <AccountDeletionModal
        code={accountDeletionCode}
        confirmation={accountDeletionConfirmation}
        currentPassword={accountDeletionCurrentPassword}
        error={accountDeletionError}
        onCancel={closeAccountDeletion}
        onCodeChange={(value) => {
          setAccountDeletionCode(normalizeMobileAccountDeletionCode(value));
          setAccountDeletionError(null);
        }}
        onConfirmationChange={(value) => {
          setAccountDeletionConfirmation(value);
          setAccountDeletionError(null);
        }}
        onCurrentPasswordChange={(value) => {
          setAccountDeletionCurrentPassword(value);
          setAccountDeletionError(null);
        }}
        onSubmit={
          accountDeletionStep === "request"
            ? () => void handleAccountDeletionRequest()
            : () => void handleAccountDeletionConfirm()
        }
        saving={savingAccountDeletion}
        step={accountDeletionStep}
        visible={accountDeletionOpen}
      />
      <SensitiveSecurityToggleModal
        error={sensitiveToggleError}
        onCancel={closeSensitiveToggle}
        onPasswordChange={setSensitiveTogglePassword}
        onSubmit={() => void handleSensitiveToggleSubmit()}
        password={sensitiveTogglePassword}
        saving={savingSensitiveToggle}
        state={sensitiveToggle}
      />
      <PasswordChangeModal
        error={passwordChangeError}
        form={passwordChangeForm}
        onCancel={closePasswordChange}
        onChangeField={updatePasswordChangeField}
        onSubmit={() => void handlePasswordChangeSubmit()}
        saving={savingPasswordChange}
        visible={passwordChangeOpen}
      />
    </Screen>
  );
}

function SensitiveSecurityToggleModal({
  error,
  onCancel,
  onPasswordChange,
  onSubmit,
  password,
  saving,
  state
}: {
  error: string | null;
  onCancel: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  password: string;
  saving: boolean;
  state: MobileSensitiveSecurityToggleState | null;
}) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(state)} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.eyebrow}>Güvenlik doğrulaması</Text>
          <Text style={styles.title}>
            {state ? buildMobileSensitiveToggleTitle(state.target) : "Güvenlik ayarını değiştir"}
          </Text>
          <Text style={styles.text}>
            {state
              ? buildMobileSensitiveToggleDescription(state.target, state.nextEnabled)
              : "Bu ayarı değiştirmek için mevcut şifreni gir."}
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            onChangeText={onPasswordChange}
            placeholder="Mevcut şifre"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed || saving ? styles.pressed : null
              ]}
            >
              <Text style={styles.secondaryButtonText}>Vazgeç</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed || saving ? styles.pressed : null
              ]}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Doğrulanıyor..." : "Onayla"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AccountDeletionModal({
  code,
  confirmation,
  currentPassword,
  error,
  onCancel,
  onCodeChange,
  onConfirmationChange,
  onCurrentPasswordChange,
  onSubmit,
  saving,
  step,
  visible
}: {
  code: string;
  confirmation: string;
  currentPassword: string;
  error: string | null;
  onCancel: () => void;
  onCodeChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  step: "request" | "confirm";
  visible: boolean;
}) {
  const isRequestStep = step === "request";

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.eyebrow}>Kalıcı işlem</Text>
          <Text style={styles.title}>
            {isRequestStep ? "Hesap silme kodu iste" : "Hesap silmeyi onayla"}
          </Text>
          <Text style={styles.text}>
            {isRequestStep
              ? "Şifreyle açılan hesaplarda mevcut şifreni gir. Yalnızca Google ile giriş yaptıysan alanı boş bırakabilirsin."
              : `E-postana gelen 6 haneli kodu gir ve onay alanına tam olarak ${MOBILE_ACCOUNT_DELETION_CONFIRMATION} yaz.`}
          </Text>

          {isRequestStep ? (
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              onChangeText={onCurrentPasswordChange}
              placeholder="Mevcut şifre (Google hesabında boş bırak)"
              placeholderTextColor={colors.subtle}
              secureTextEntry
              style={styles.input}
              value={currentPassword}
            />
          ) : (
            <>
              <TextInput
                editable={!saving}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={onCodeChange}
                placeholder="6 haneli güvenlik kodu"
                placeholderTextColor={colors.subtle}
                style={styles.input}
                value={code}
              />
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!saving}
                onChangeText={onConfirmationChange}
                placeholder={MOBILE_ACCOUNT_DELETION_CONFIRMATION}
                placeholderTextColor={colors.subtle}
                style={styles.input}
                value={confirmation}
              />
            </>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed || saving ? styles.pressed : null
              ]}
            >
              <Text style={styles.secondaryButtonText}>Vazgeç</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed || saving ? styles.pressed : null
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {saving
                  ? isRequestStep
                    ? "Kod gönderiliyor..."
                    : "Hesap siliniyor..."
                  : isRequestStep
                    ? "Kodu gönder"
                    : "Hesabı kalıcı olarak sil"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PasswordChangeModal({
  error,
  form,
  onCancel,
  onChangeField,
  onSubmit,
  saving,
  visible
}: {
  error: string | null;
  form: MobilePasswordChangeForm;
  onCancel: () => void;
  onChangeField: (field: keyof MobilePasswordChangeForm, value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Şifreyi değiştir</Text>
          <Text style={styles.text}>Şifre değişince diğer cihazlardaki oturumlar kapatılır.</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            onChangeText={(value) => onChangeField("currentPassword", value)}
            placeholder="Mevcut şifre"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={styles.input}
            value={form.currentPassword}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            onChangeText={(value) => onChangeField("newPassword", value)}
            placeholder="Yeni şifre"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={styles.input}
            value={form.newPassword}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            onChangeText={(value) => onChangeField("confirmPassword", value)}
            placeholder="Yeni şifre tekrar"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={styles.input}
            value={form.confirmPassword}
          />
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed || saving ? styles.pressed : null
              ]}
            >
              <Text style={styles.secondaryButtonText}>Vazgeç</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed || saving ? styles.pressed : null
              ]}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Kaydediliyor..." : "Onayla"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getSecurityRowAction({
  loadingLoginApprovalStatus,
  loadingMfaStatus,
  mfaEnabled,
  mobileLoginApprovalEnabled,
  openPasswordChange,
  openSensitiveToggle,
  rowTitle,
  savingLoginApproval,
  savingMfa
}: {
  loadingLoginApprovalStatus: boolean;
  loadingMfaStatus: boolean;
  mfaEnabled: boolean | null;
  mobileLoginApprovalEnabled: boolean | null;
  openPasswordChange: () => void;
  openSensitiveToggle: (target: MobileSensitiveSecurityToggleTarget, nextEnabled: boolean) => void;
  rowTitle: string;
  savingLoginApproval: boolean;
  savingMfa: boolean;
}): ReactNode {
  if (rowTitle === "Şifre") {
    return (
      <Pressable
        onPress={openPasswordChange}
        style={({ pressed }) => [
          styles.compactActionButton,
          pressed ? styles.pressed : null
        ]}
      >
        <Text style={styles.compactActionButtonText}>Değiştir</Text>
      </Pressable>
    );
  }

  if (rowTitle === "OTP / MFA") {
    return (
      <Switch
        disabled={savingMfa || loadingMfaStatus || mfaEnabled === null}
        onValueChange={(nextEnabled) => openSensitiveToggle("mfa_email_otp", nextEnabled)}
        value={mfaEnabled === true}
      />
    );
  }

  if (rowTitle === "Mobil onay") {
    return (
      <Switch
        disabled={savingLoginApproval || loadingLoginApprovalStatus || mobileLoginApprovalEnabled === null}
        onValueChange={(nextEnabled) => openSensitiveToggle("mobile_login_approval", nextEnabled)}
        value={mobileLoginApprovalEnabled === true}
      />
    );
  }

  return null;
}

function SecurityRow({
  action,
  badge,
  title,
  tone,
  value
}: {
  action?: ReactNode;
  badge?: string;
  title: string;
  tone: MobileSecurityRowTone;
  value: string;
}) {
  return (
    <MobileCard style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{title}</Text>
        {badge ? (
          <View style={[styles.badge, getBadgeStyle(tone)]}>
            <Text style={[styles.badgeText, getBadgeTextStyle(tone)]}>{badge}</Text>
          </View>
        ) : null}
        {action ? <View style={styles.rowAction}>{action}</View> : null}
      </View>
      <Text style={styles.rowText}>{value}</Text>
    </MobileCard>
  );
}

function getBadgeStyle(tone: MobileSecurityRowTone) {
  if (tone === "success") {
    return styles.badgeSuccess;
  }

  if (tone === "pending") {
    return styles.badgePending;
  }

  return styles.badgeNeutral;
}

function getBadgeTextStyle(tone: MobileSecurityRowTone) {
  if (tone === "success") {
    return styles.badgeSuccessText;
  }

  if (tone === "pending") {
    return styles.badgePendingText;
  }

  return styles.badgeNeutralText;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    gap: 12,
    maxWidth: 420,
    padding: 20,
    width: "100%"
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end"
  },
  list: {
    gap: spacing.md
  },
  card: {
    gap: spacing.md
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  row: {
    gap: spacing.sm
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  rowTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  rowAction: {
    marginLeft: spacing.xs
  },
  rowText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900"
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft
  },
  badgeSuccessText: {
    color: colors.success
  },
  badgePending: {
    backgroundColor: colors.surfaceSoft
  },
  badgePendingText: {
    color: colors.primaryDark
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceSoft
  },
  badgeNeutralText: {
    color: colors.muted
  },
  input: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
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
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.75
  },
  successBox: {
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    padding: 12
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
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
  emptyBox: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  sessionList: {
    gap: spacing.md
  },
  sessionCard: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  sessionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  sessionTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  sessionMeta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  currentBadge: {
    borderRadius: 999,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  currentBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "900"
  },
  feedbackList: {
    gap: spacing.sm
  },
  compactActionButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  compactActionButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  }
});
