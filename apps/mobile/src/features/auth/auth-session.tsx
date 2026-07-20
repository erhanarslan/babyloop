import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { disconnectMobileRealtimeSocket } from "../realtime/mobile-realtime";
import { addMobileCartItem } from "../basket/basket-api";
import { saveMobileFavorite } from "../favorites/favorites-api";
import { startMobileConversationForListing } from "../messages/messages-api";
import { claimPendingMobileLoginIntent } from "./mobile-login-intent";
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

type AuthSessionStatus =
  | "checking"
  | "guest"
  | "authenticated"
  | "mfa_required"
  | "error";

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
  const router = useRouter();
  const postLoginIntentInFlightRef = useRef(false);
  const [status, setStatus] = useState<AuthSessionStatus>("checking");
  const [currentUser, setCurrentUser] = useState<MobileAuthMe | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MobileMfaChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearChallenges = useCallback(() => {
    setMfaChallenge(null);
  }, []);

  const refresh = useCallback(async () => {
    setStatus("checking");
    setError(null);
    clearChallenges();

    const hydratedToken = await hydrateMobileAuthToken();

    if (!hydratedToken) {
      const refreshed = await refreshMobileSession();

      if (!refreshed.ok) {
        setCurrentUser(null);
        setStatus("guest");
        return;
      }

      setCurrentUser({
        user: refreshed.data.user,
        profile: refreshed.data.profile
      });
      setStatus("authenticated");
      return;
    }

    const currentSession = await fetchMobileCurrentUser();

    if (!currentSession.ok) {
      setCurrentUser(null);
      setStatus("guest");
      return;
    }

    setCurrentUser(currentSession.data);
    setStatus("authenticated");
  }, [clearChallenges]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // post-login marketplace intent: favorite/message/cart after auth is truly ready
  useEffect(() => {
    if (status !== "authenticated" || !currentUser || postLoginIntentInFlightRef.current) {
      return;
    }

    let active = true;

    void claimPendingMobileLoginIntent().then(async (intent) => {
      if (!active || !intent || postLoginIntentInFlightRef.current) {
        return;
      }

      postLoginIntentInFlightRef.current = true;
      const listingPath = `/listing/${encodeURIComponent(intent.listingId)}`;

      try {
        if (intent.action === "favorite") {
          await saveMobileFavorite(intent.listingId, true);

          if (active) {
            router.replace(listingPath);
          }

          return;
        }

        if (intent.action === "message") {
          const conversation = await startMobileConversationForListing(intent.listingId);

          if (active) {
            router.replace(`/conversation/${encodeURIComponent(conversation.id)}`);
          }

          return;
        }

        if (intent.action === "cart") {
          await addMobileCartItem(intent.listingId);

          if (active) {
            router.replace(listingPath);
          }
        }
      } catch (error) {
        if (active) {
          Alert.alert(
            "İşlem tamamlanamadı",
            error instanceof Error ? error.message : "Giriş sonrası işlem tamamlanamadı."
          );
          router.replace(listingPath);
        }
      } finally {
        postLoginIntentInFlightRef.current = false;
      }
    });

    return () => {
      active = false;
    };
  }, [currentUser, router, status]);

  const applyAuthenticatedPayload = useCallback(async (payload: MobileAuthMe): Promise<void> => {
    setCurrentUser(payload);
    clearChallenges();
    setError(null);
    setStatus("authenticated");
  }, [clearChallenges]);

  const handleUnexpectedMobileApprovalRequired = useCallback(() => {
    setCurrentUser(null);
    clearChallenges();
    setStatus("error");
    setError("Mobil uygulama girişinde mobil onay beklenmez. Lütfen tekrar giriş yap.");
  }, [clearChallenges]);

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
            setStatus("mfa_required");
        setError(null);
        return false;
      }

      if ("loginApprovalRequired" in result.data) {
        handleUnexpectedMobileApprovalRequired();
        return false;
      }

      await applyAuthenticatedPayload({
        user: result.data.user,
        profile: result.data.profile
      });

      return true;
    },
    [applyAuthenticatedPayload, clearChallenges, handleUnexpectedMobileApprovalRequired]
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
        handleUnexpectedMobileApprovalRequired();
        return false;
      }

      await applyAuthenticatedPayload({
        user: result.data.user,
        profile: result.data.profile
      });

      return true;
    },
    [applyAuthenticatedPayload, handleUnexpectedMobileApprovalRequired, mfaChallenge]
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
      login,
      register,
      verifyMfa,
      cancelMfa,
      logout,
      refresh
    }),
    [
      cancelMfa,
      currentUser,
      error,
      login,
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
