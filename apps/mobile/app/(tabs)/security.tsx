import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/auth-session";
import { subscribeMobileRealtime } from "../../src/features/realtime/mobile-realtime";
import {
  approveMobileLoginApproval,
  denyMobileLoginApproval,
  disableMobileLoginApproval,
  disableMobileMfa,
  enableMobileLoginApproval,
  enableMobileMfa,
  fetchMobileAuthSessions,
  fetchMobileLoginApprovals,
  fetchMobileLoginApprovalStatus,
  fetchMobileMfaStatus,
  revokeAllMobileAuthSessions,
  revokeMobileAuthSession,
  type MobileAuthSession,
  type MobileLoginApprovalChallenge
} from "../../src/features/auth/auth-api";
import {
  buildMobileSensitiveToggleDescription,
  buildMobileSensitiveToggleTitle,
  canSubmitMobileSensitiveTogglePassword,
  getMobileSecurityRows,
  type MobileSecurityRowTone,
  type MobileSensitiveSecurityToggleState,
  type MobileSensitiveSecurityToggleTarget
} from "../../src/features/security/security-model";
import {
  buildMobileLoginApprovalCards,
  getMobileLoginApprovalSummary
} from "../../src/features/security/mobile-login-approval-model";
import {
  buildMobileSessionCards,
  getMobileSessionSummary
} from "../../src/features/security/mobile-session-model";
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
  const [pendingLoginApprovals, setPendingLoginApprovals] = useState<MobileLoginApprovalChallenge[]>([]);
  const [loadingLoginApprovals, setLoadingLoginApprovals] = useState(false);
  const [resolvingApprovalId, setResolvingApprovalId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<MobileAuthSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAllSessions, setRevokingAllSessions] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setMfaEnabled(null);
      setMobileLoginApprovalEnabled(null);
      setSensitiveToggle(null);
      setSensitiveTogglePassword("");
      setSensitiveToggleError(null);
      setPendingLoginApprovals([]);
      setSessions([]);
      setCurrentSessionId(null);
      return;
    }

    let cancelled = false;

    async function loadMfaStatus() {
      setLoadingMfaStatus(true);
      setMfaError(null);

      const response = await fetchMobileMfaStatus();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setMfaEnabled(response.data.mfaEnabled);
      } else {
        setMfaEnabled(null);
        setMfaError(response.error.message);
      }

      setLoadingMfaStatus(false);
    }

    async function loadLoginApprovalStatus() {
      setLoadingLoginApprovalStatus(true);
      setLoginApprovalError(null);

      const response = await fetchMobileLoginApprovalStatus();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setMobileLoginApprovalEnabled(response.data.mobileLoginApprovalEnabled);
      } else {
        setMobileLoginApprovalEnabled(null);
        setLoginApprovalError(response.error.message);
      }

      setLoadingLoginApprovalStatus(false);
    }

    async function loadLoginApprovals() {
      setLoadingLoginApprovals(true);

      const response = await fetchMobileLoginApprovals();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setPendingLoginApprovals(response.data.approvals);
      } else {
        setPendingLoginApprovals([]);
        setLoginApprovalError(response.error.message);
      }

      setLoadingLoginApprovals(false);
    }

    async function loadSessions() {
      setLoadingSessions(true);
      setSessionError(null);

      const response = await fetchMobileAuthSessions();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setSessions(response.data.sessions);
        setCurrentSessionId(response.data.currentSessionId);
      } else {
        setSessions([]);
        setCurrentSessionId(null);
        setSessionError(response.error.message);
      }

      setLoadingSessions(false);
    }

    void loadMfaStatus();
    void loadLoginApprovalStatus();
    void loadLoginApprovals();
    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const securityRows = useMemo(
    () => getMobileSecurityRows({
      mfaEnabled,
      mobileLoginApprovalEnabled,
      pendingLoginApprovalCount: pendingLoginApprovals.length
    }),
    [mfaEnabled, mobileLoginApprovalEnabled, pendingLoginApprovals.length]
  );
  const loginApprovalCards = useMemo(
    () => buildMobileLoginApprovalCards(pendingLoginApprovals),
    [pendingLoginApprovals]
  );
  const loginApprovalSummary = useMemo(
    () => getMobileLoginApprovalSummary(pendingLoginApprovals),
    [pendingLoginApprovals]
  );
  const sessionCards = useMemo(
    () => buildMobileSessionCards(sessions, currentSessionId),
    [sessions, currentSessionId]
  );
  const sessionSummary = useMemo(
    () => getMobileSessionSummary(sessions, currentSessionId),
    [sessions, currentSessionId]
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeMobileRealtime({
      onLoginApprovalCreated: (payload) => {
        setPendingLoginApprovals((current) =>
          mergePendingLoginApprovals(current, payload.approval)
        );
        setLoginApprovalError(null);
        setLoginApprovalMessage("Yeni giriş isteği geldi. Onaylamak veya reddetmek için kartı kullan.");
      }
    }).then((subscription) => {
      if (!active) {
        subscription.unsubscribe();
        return;
      }

      unsubscribe = subscription.unsubscribe;
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentUser]);

  async function handleLogout() {
    await authSession.logout();
    router.replace("/");
  }

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

  async function handleLoginApprovalsRefresh() {
    setLoadingLoginApprovals(true);
    setLoginApprovalError(null);
    setLoginApprovalMessage(null);

    const response = await fetchMobileLoginApprovals();

    if (response.ok) {
      setPendingLoginApprovals(response.data.approvals);
    } else {
      setPendingLoginApprovals([]);
      setLoginApprovalError(response.error.message);
    }

    setLoadingLoginApprovals(false);
  }

  async function handleResolveLoginApproval(approvalId: string, action: "approve" | "deny") {
    setResolvingApprovalId(approvalId);
    setLoginApprovalError(null);
    setLoginApprovalMessage(null);

    try {
      const response = action === "approve"
        ? await approveMobileLoginApproval(approvalId)
        : await denyMobileLoginApproval(approvalId);

      if (!response.ok) {
        setLoginApprovalError(response.error.message);
        return;
      }

      setPendingLoginApprovals((current) => current.filter((approval) => approval.id !== response.data.approvalId));

      if (response.data.status === "approved") {
        await handleSessionRefresh();
      }

      setLoginApprovalMessage(
        response.data.status === "approved"
          ? "Giriş isteği onaylandı. Aktif cihazlar güncellendi."
          : "Giriş isteği reddedildi."
      );
    } finally {
      setResolvingApprovalId(null);
    }
  }

  async function handleSessionRefresh() {
    setLoadingSessions(true);
    setSessionError(null);
    setSessionMessage(null);

    const response = await fetchMobileAuthSessions();

    if (response.ok) {
      setSessions(response.data.sessions);
      setCurrentSessionId(response.data.currentSessionId);
    } else {
      setMobileLoginApprovalEnabled(null);
      setSensitiveToggle(null);
      setSensitiveTogglePassword("");
      setSensitiveToggleError(null);
      setPendingLoginApprovals([]);
      setSessions([]);
      setCurrentSessionId(null);
      setSessionError(response.error.message);
    }

    setLoadingSessions(false);
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

  async function handleRevokeAllSessions() {
    setRevokingAllSessions(true);
    setSessionMessage(null);
    setSessionError(null);

    try {
      const response = await revokeAllMobileAuthSessions();

      if (!response.ok) {
        setSessionError(response.error.message);
        return;
      }

      setMobileLoginApprovalEnabled(null);
      setSensitiveToggle(null);
      setSensitiveTogglePassword("");
      setSensitiveToggleError(null);
      setPendingLoginApprovals([]);
      setSessions([]);
      setCurrentSessionId(null);
      await authSession.logout();
      router.replace("/login");
    } finally {
      setRevokingAllSessions(false);
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

  return (
    <Screen eyebrow="Hesap" title="Güvenlik">
      <MobileCard style={styles.profileCard}>
        <Text style={styles.eyebrow}>Aktif oturum</Text>
        <Text style={styles.title}>{currentUser.profile.displayName}</Text>
        <Text style={styles.text}>{currentUser.user.email}</Text>
        {currentUser.profile.locationCity ? (
          <Text style={styles.meta}>{currentUser.profile.locationCity}</Text>
        ) : null}
      </MobileCard>

      <View style={styles.list}>
        {securityRows.map((row) => (
          <SecurityRow
            action={getSecurityRowAction({
              loadingLoginApprovalStatus,
              loadingMfaStatus,
              mfaEnabled,
              mobileLoginApprovalEnabled,
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

      <MobileCard style={styles.card}>
        <View style={styles.approvalHeader}>
          <View style={styles.approvalHeaderText}>
            <Text style={styles.emptyTitle}>Bekleyen giriş istekleri</Text>
            <Text style={styles.text}>{loginApprovalSummary.activeCountLabel}</Text>
          </View>
          <Pressable
            disabled={loadingLoginApprovals}
            onPress={() => void handleLoginApprovalsRefresh()}
            style={({ pressed }) => [
              styles.smallSecondaryButton,
              pressed || loadingLoginApprovals ? styles.pressed : null
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {loadingLoginApprovals ? "Yenileniyor..." : "Yenile"}
            </Text>
          </Pressable>
        </View>

        {!loadingLoginApprovals && loginApprovalCards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Bekleyen istek yok</Text>
            <Text style={styles.text}>{loginApprovalSummary.emptyLabel}</Text>
          </View>
        ) : null}

        <View style={styles.sessionList}>
          {loginApprovalCards.map((approval) => (
            <View key={approval.id} style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>{approval.title}</Text>
              <Text style={styles.sessionSubtitle}>{approval.subtitle}</Text>
              <Text style={styles.sessionMeta}>{approval.meta}</Text>
              <View style={styles.approvalActions}>
                <Pressable
                  disabled={resolvingApprovalId === approval.id}
                  onPress={() => void handleResolveLoginApproval(approval.id, "approve")}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed || resolvingApprovalId === approval.id ? styles.pressed : null
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {resolvingApprovalId === approval.id ? "İşleniyor..." : approval.approveLabel}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={resolvingApprovalId === approval.id}
                  onPress={() => void handleResolveLoginApproval(approval.id, "deny")}
                  style={({ pressed }) => [
                    styles.dangerOutlineButton,
                    pressed || resolvingApprovalId === approval.id ? styles.pressed : null
                  ]}
                >
                  <Text style={styles.dangerOutlineButtonText}>{approval.denyLabel}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

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
      </MobileCard>

      <MobileCard style={styles.card}>
        <Text style={styles.title}>Aktif cihazlar</Text>
        <Text style={styles.text}>
          {sessionSummary.activeCountLabel} · {sessionSummary.currentDeviceLabel}
        </Text>
        <Text style={styles.meta}>
          Oturum tokenları, refresh token hashleri ve şifre bilgileri bu ekranda gösterilmez.
        </Text>

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
            <Text style={styles.emptyTitle}>Aktif oturum görünmüyor</Text>
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
                ) : null}
              </View>
              <Text style={styles.sessionSubtitle}>{session.subtitle}</Text>
              <Text style={styles.sessionMeta}>{session.meta}</Text>
              <Pressable
                disabled={revokingSessionId === session.id || revokingAllSessions}
                onPress={() => void handleRevokeSession(session.id)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed || revokingSessionId === session.id || revokingAllSessions ? styles.pressed : null
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {revokingSessionId === session.id ? "Kapatılıyor..." : session.actionLabel}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.sessionActions}>
          <Pressable
            disabled={loadingSessions || revokingAllSessions}
            onPress={() => void handleSessionRefresh()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed || loadingSessions ? styles.pressed : null
            ]}
          >
            <Text style={styles.secondaryButtonText}>Oturumları yenile</Text>
          </Pressable>

          <Pressable
            disabled={revokingAllSessions || sessions.length === 0}
            onPress={() => void handleRevokeAllSessions()}
            style={({ pressed }) => [
              styles.dangerButton,
              pressed || revokingAllSessions || sessions.length === 0 ? styles.pressed : null
            ]}
          >
            <Text style={styles.dangerButtonText}>
              {revokingAllSessions ? "Çıkış yapılıyor..." : "Tüm cihazlardan çıkış yap"}
            </Text>
          </Pressable>

          <MobileButton iconName="log-out-outline" onPress={() => void handleLogout()} variant="danger">
            Bu cihazdan çıkış yap
          </MobileButton>
        </View>
      </MobileCard>

      <SensitiveSecurityToggleModal
        error={sensitiveToggleError}
        onCancel={closeSensitiveToggle}
        onPasswordChange={setSensitiveTogglePassword}
        onSubmit={() => void handleSensitiveToggleSubmit()}
        password={sensitiveTogglePassword}
        saving={savingSensitiveToggle}
        state={sensitiveToggle}
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

function getSecurityRowAction({
  loadingLoginApprovalStatus,
  loadingMfaStatus,
  mfaEnabled,
  mobileLoginApprovalEnabled,
  openSensitiveToggle,
  rowTitle,
  savingLoginApproval,
  savingMfa
}: {
  loadingLoginApprovalStatus: boolean;
  loadingMfaStatus: boolean;
  mfaEnabled: boolean | null;
  mobileLoginApprovalEnabled: boolean | null;
  openSensitiveToggle: (target: MobileSensitiveSecurityToggleTarget, nextEnabled: boolean) => void;
  rowTitle: string;
  savingLoginApproval: boolean;
  savingMfa: boolean;
}): ReactNode {
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
  badge: string;
  title: string;
  tone: MobileSecurityRowTone;
  value: string;
}) {
  return (
    <MobileCard style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{title}</Text>
        <View style={[styles.badge, getBadgeStyle(tone)]}>
          <Text style={[styles.badgeText, getBadgeTextStyle(tone)]}>{badge}</Text>
        </View>
        {action ? <View style={styles.rowAction}>{action}</View> : null}
      </View>
      <Text style={styles.rowText}>{value}</Text>
    </MobileCard>
  );
}

function mergePendingLoginApprovals(
  current: MobileLoginApprovalChallenge[],
  approval: MobileLoginApprovalChallenge
): MobileLoginApprovalChallenge[] {
  const merged = [
    approval,
    ...current.filter((currentApproval) => currentApproval.id !== approval.id)
  ];

  return merged.sort((left, right) => {
    return getDateTime(right.createdAt) - getDateTime(left.createdAt);
  });
}

function getDateTime(value: string): number {
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
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
  toggleRow: {
    alignItems: "center",
    borderColor: "rgba(148, 163, 184, 0.28)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    padding: 14
  },
  toggleText: {
    flex: 1,
    gap: 4
  },
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
  profileCard: {
    gap: spacing.sm,
    backgroundColor: colors.cream
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
  meta: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: "700"
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
  badgeWarning: {
    backgroundColor: colors.warningSoft
  },
  badgeWarningText: {
    color: colors.warning
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
  dangerButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  dangerButtonText: {
    color: colors.primaryForeground,
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
  sessionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
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
  sessionActions: {
    gap: spacing.sm
  },
  approvalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  approvalHeaderText: {
    flex: 1,
    gap: 2
  },
  approvalActions: {
    gap: spacing.sm
  },
  smallSecondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  dangerOutlineButton: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  dangerOutlineButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900"
  }
});
