import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { disconnectMobileRealtimeSocket } from "../realtime/mobile-realtime";
import {
  fetchMobileCurrentUser,
  hydrateMobileAuthToken,
  logoutMobileSession,
  refreshMobileSession,
  submitMobileAuthRequest,
  verifyMobileMfaLogin,
  type MobileAuthMe,
  type MobileAuthMode,
  type MobileAuthRequest,
  type MobileMfaChallenge
} from "./auth-api";

type AuthSessionStatus = "checking" | "guest" | "authenticated" | "mfa_required" | "error";

type AuthSessionContextValue = {
  status: AuthSessionStatus;
  currentUser: MobileAuthMe | null;
  error: string | null;
  mfaChallenge: MobileMfaChallenge | null;
  login: (payload: MobileAuthRequest) => Promise<boolean>;
  register: (payload: MobileAuthRequest) => Promise<boolean>;
  verifyMfa: (code: string) => Promise<boolean>;
  cancelMfa: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthSessionStatus>("checking");
  const [currentUser, setCurrentUser] = useState<MobileAuthMe | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MobileMfaChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("checking");
    setError(null);
    setMfaChallenge(null);

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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyAuthenticatedPayload = useCallback(async (fallback: MobileAuthMe): Promise<void> => {
    const me = await fetchMobileCurrentUser();

    if (!me.ok) {
      setCurrentUser(fallback);
    } else {
      setCurrentUser(me.data);
    }

    setMfaChallenge(null);
    setError(null);
    setStatus("authenticated");
  }, []);

  const submit = useCallback(
    async (mode: MobileAuthMode, payload: MobileAuthRequest): Promise<boolean> => {
      setError(null);
      setMfaChallenge(null);

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
        setStatus("mfa_required");
        setError(null);
        return false;
      }

      await applyAuthenticatedPayload({
        user: result.data.user,
        profile: result.data.profile
      });

      return true;
    },
    [applyAuthenticatedPayload]
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

      await applyAuthenticatedPayload({
        user: result.data.user,
        profile: result.data.profile
      });

      return true;
    },
    [applyAuthenticatedPayload, mfaChallenge]
  );

  const cancelMfa = useCallback(() => {
    setMfaChallenge(null);
    setCurrentUser(null);
    setError(null);
    setStatus("guest");
  }, []);

  const logout = useCallback(async () => {
    disconnectMobileRealtimeSocket();
    await logoutMobileSession();
    setCurrentUser(null);
    setMfaChallenge(null);
    setError(null);
    setStatus("guest");
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      status,
      currentUser,
      error,
      mfaChallenge,
      login,
      register,
      verifyMfa,
      cancelMfa,
      logout,
      refresh
    }),
    [cancelMfa, currentUser, error, login, logout, mfaChallenge, refresh, register, status, verifyMfa]
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
