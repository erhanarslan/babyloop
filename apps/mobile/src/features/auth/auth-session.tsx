import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchMobileCurrentUser,
  logoutMobileSession,
  refreshMobileSession,
  submitMobileAuthRequest,
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
        setError("Bu hesap için MFA doğrulaması gerekiyor. Mobil MFA doğrulama ekranı sonraki pakette eklenecek.");
        return false;
      }

      const me = await fetchMobileCurrentUser();

      if (!me.ok) {
        setCurrentUser({
          user: result.data.user,
          profile: result.data.profile
        });
      } else {
        setCurrentUser(me.data);
      }

      setStatus("authenticated");
      return true;
    },
    []
  );

  const login = useCallback(
    (payload: MobileAuthRequest) => submit("login", payload),
    [submit]
  );

  const register = useCallback(
    (payload: MobileAuthRequest) => submit("register", payload),
    [submit]
  );

  const logout = useCallback(async () => {
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
      logout,
      refresh
    }),
    [currentUser, error, login, logout, mfaChallenge, refresh, register, status]
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
