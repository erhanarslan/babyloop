import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  disconnectMobileRealtimeSocket,
  subscribeMobileRealtime
} from "../realtime/mobile-realtime";
import {
  completeMobileLoginApproval,
  fetchMobileCurrentUser,
  hydrateMobileAuthToken,
  logoutMobileSession,
  refreshMobileSession,
  submitMobileAuthRequest,
  verifyMobileMfaLogin,
  type MobileAuthMe,
  type MobileAuthMode,
  type MobileAuthRequest,
  type MobileLoginApprovalRequiredPayload,
  type MobileMfaChallenge
} from "./auth-api";

type AuthSessionStatus =
  | "checking"
  | "guest"
  | "authenticated"
  | "mfa_required"
  | "login_approval_required"
  | "error";

type AuthSessionContextValue = {
  status: AuthSessionStatus;
  currentUser: MobileAuthMe | null;
  error: string | null;
  mfaChallenge: MobileMfaChallenge | null;
  loginApprovalChallenge: MobileLoginApprovalRequiredPayload | null;
  login: (payload: MobileAuthRequest) => Promise<boolean>;
  register: (payload: MobileAuthRequest) => Promise<boolean>;
  verifyMfa: (code: string) => Promise<boolean>;
  completeLoginApproval: () => Promise<boolean>;
  cancelMfa: () => void;
  cancelLoginApproval: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthSessionStatus>("checking");
  const [currentUser, setCurrentUser] = useState<MobileAuthMe | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MobileMfaChallenge | null>(null);
  const [loginApprovalChallenge, setLoginApprovalChallenge] =
    useState<MobileLoginApprovalRequiredPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearChallenges = useCallback(() => {
    setMfaChallenge(null);
    setLoginApprovalChallenge(null);
  }, []);

  const refresh = useCallback(async () => {
    setStatus("checking");
    setError(null);
    clearChallenges();

    const hydratedToken = await hydrateMobileAuthToken();

    if (hydratedToken) {
      const currentSession = await fetchMobileCurrentUser();

      if (currentSession.ok) {
        setCurrentUser(currentSession.data);
        setStatus("authenticated");
        return;
      }
    }

    const refreshed = await refreshMobileSession();

    if (!refreshed.ok) {
      setCurrentUser(null);
      setStatus("guest");
      return;
    }

    const me = await fetchMobileCurrentUser();

    if (!me.ok) {
      setCurrentUser(null);
      setStatus("guest");
      return;
    }

    setCurrentUser(me.data);
    setStatus("authenticated");
  }, [clearChallenges]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!currentUser || status !== "authenticated") {
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    void subscribeMobileRealtime({
      onLoginApprovalCreated: (payload) => {
        if (!active || pathname.includes("/security")) {
          return;
        }

        Alert.alert(
          "Yeni giriş isteği",
          `${payload.approval.deviceLabel} için mobil onay bekleniyor. Güvenlik ekranından onaylayabilir veya reddedebilirsin.`
        );
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
  }, [currentUser, pathname, status]);

  const applyAuthenticatedPayload = useCallback(async (fallback: MobileAuthMe): Promise<void> => {
    const me = await fetchMobileCurrentUser();

    if (!me.ok) {
      setCurrentUser(fallback);
    } else {
      setCurrentUser(me.data);
    }

    clearChallenges();
    setError(null);
    setStatus("authenticated");
  }, [clearChallenges]);

  const applyLoginApprovalRequired = useCallback((challenge: MobileLoginApprovalRequiredPayload) => {
    setCurrentUser(null);
    setMfaChallenge(null);
    setLoginApprovalChallenge(challenge);
    setStatus("login_approval_required");
    setError(null);
  }, []);

  const submit = useCallback(
    async (mode: MobileAuthMode, payload: MobileAuthRequest): Promise<boolean> => {
      setError(null);
      clearChallenges();

      const result = await submitMobileAuthRequest(mode, payload);

      if (!result.ok) {
        setCurrentUser(null);
        setStatus("error");
        setError(result.error.message);
        return false;
      }

      if ("mfaRequired" in result.data) {
        setCurrentUser(null);
        setMfaChallenge(result.data);
        setLoginApprovalChallenge(null);
        setStatus("mfa_required");
        setError(null);
        return false;
      }

      if ("loginApprovalRequired" in result.data) {
        applyLoginApprovalRequired(result.data);
        return false;
      }

      await applyAuthenticatedPayload({
        user: result.data.user,
        profile: result.data.profile
      });

      return true;
    },
    [applyAuthenticatedPayload, applyLoginApprovalRequired, clearChallenges]
  );

  const login = useCallback(
    (payload: MobileAuthRequest) => submit("login", payload),
    [submit]
  );

  const register = useCallback(
    (payload: MobileAuthRequest) => submit("register", payload),
    [submit]
  );

  const verifyMfa = useCallback(
    async (code: string): Promise<boolean> => {
      if (!mfaChallenge) {
        setStatus("guest");
        setError("MFA doğrulama isteği bulunamadı. Lütfen yeniden giriş yap.");
        return false;
      }

      setError(null);

      const result = await verifyMobileMfaLogin({
        challengeId: mfaChallenge.challengeId,
        code: code.trim()
      });

      if (!result.ok) {
        setStatus("mfa_required");
        setError(result.error.message);
        return false;
      }

      if ("loginApprovalRequired" in result.data) {
        applyLoginApprovalRequired(result.data);
        return false;
      }

      await applyAuthenticatedPayload({
        user: result.data.user,
        profile: result.data.profile
      });

      return true;
    },
    [applyAuthenticatedPayload, applyLoginApprovalRequired, mfaChallenge]
  );

  const completeLoginApproval = useCallback(async (): Promise<boolean> => {
    if (!loginApprovalChallenge) {
      setStatus("guest");
      setError("Mobil onay isteği bulunamadı. Lütfen yeniden giriş yap.");
      return false;
    }

    const result = await completeMobileLoginApproval(loginApprovalChallenge.approvalToken);

    if (!result.ok) {
      return false;
    }

    await applyAuthenticatedPayload({
      user: result.data.user,
      profile: result.data.profile
    });

    return true;
  }, [applyAuthenticatedPayload, loginApprovalChallenge]);

  const cancelMfa = useCallback(() => {
    setMfaChallenge(null);
    setLoginApprovalChallenge(null);
    setCurrentUser(null);
    setError(null);
    setStatus("guest");
  }, []);

  const cancelLoginApproval = useCallback(() => {
    setLoginApprovalChallenge(null);
    setMfaChallenge(null);
    setCurrentUser(null);
    setError(null);
    setStatus("guest");
  }, []);

  const logout = useCallback(async () => {
    disconnectMobileRealtimeSocket();
    await logoutMobileSession();
    setCurrentUser(null);
    clearChallenges();
    setError(null);
    setStatus("guest");
  }, [clearChallenges]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      status,
      currentUser,
      error,
      mfaChallenge,
      loginApprovalChallenge,
      login,
      register,
      verifyMfa,
      completeLoginApproval,
      cancelMfa,
      cancelLoginApproval,
      logout,
      refresh
    }),
    [
      cancelLoginApproval,
      cancelMfa,
      completeLoginApproval,
      currentUser,
      error,
      login,
      loginApprovalChallenge,
      logout,
      mfaChallenge,
      refresh,
      register,
      status,
      verifyMfa
    ]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}
