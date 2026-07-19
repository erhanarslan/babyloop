"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { AuthPayload } from "../../lib/auth-client";
import { AuthActionPromptModal } from "./auth-action-prompt-modal";

type AuthPromptOptions = {
  title?: string;
  returnTo?: string | undefined;
  onAuthenticated?: (payload: AuthPayload) => void;
};

type AuthPromptContextValue = {
  apiBaseUrl: string;
  openAuthPrompt: (options?: AuthPromptOptions) => void;
  closeAuthPrompt: () => void;
};

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null);

type AuthPromptProviderProps = {
  apiBaseUrl: string;
  children: ReactNode;
};

const DEFAULT_AUTH_TITLE = "BabyLoop’a giriş yap";

export function AuthPromptProvider({ apiBaseUrl, children }: AuthPromptProviderProps) {
  const router = useRouter();
  const [promptOptions, setPromptOptions] = useState<AuthPromptOptions | null>(null);

  const closeAuthPrompt = useCallback(() => {
    setPromptOptions(null);
  }, []);

  const openAuthPrompt = useCallback((options: AuthPromptOptions = {}) => {
    const nextOptions: AuthPromptOptions = {
      title: options.title ?? DEFAULT_AUTH_TITLE
    };

    if (options.returnTo) {
      nextOptions.returnTo = options.returnTo;
    }

    if (options.onAuthenticated) {
      nextOptions.onAuthenticated = options.onAuthenticated;
    }

    setPromptOptions(nextOptions);
  }, []);

  const value = useMemo<AuthPromptContextValue>(
    () => ({
      apiBaseUrl,
      openAuthPrompt,
      closeAuthPrompt
    }),
    [apiBaseUrl, closeAuthPrompt, openAuthPrompt]
  );

  useEffect(() => {
    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.get("auth") !== "login") {
      return;
    }

    const returnTo = normalizeReturnTo(currentUrl.searchParams.get("returnTo"));
    const title = currentUrl.searchParams.get("passwordChanged") === "1"
      ? "Şifren değişti, yeniden giriş yap"
      : currentUrl.searchParams.has("error")
        ? "Giriş tamamlanamadı, tekrar dene"
        : DEFAULT_AUTH_TITLE;

    openAuthPrompt({
      title,
      ...(returnTo ? { returnTo } : {})
    });

    for (const key of ["auth", "error", "passwordChanged", "returnTo"]) {
      currentUrl.searchParams.delete(key);
    }

    const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl || "/");
  }, [openAuthPrompt]);

  return (
    <AuthPromptContext.Provider value={value}>
      {children}

      <AuthActionPromptModal
        apiBaseUrl={apiBaseUrl}
        isOpen={Boolean(promptOptions)}
        title={promptOptions?.title ?? DEFAULT_AUTH_TITLE}
        returnTo={promptOptions?.returnTo}
        onAuthenticated={(payload) => {
          const onAuthenticated = promptOptions?.onAuthenticated;
          const returnTo = promptOptions?.returnTo;

          closeAuthPrompt();
          if (onAuthenticated) {
            onAuthenticated(payload);
          } else if (returnTo) {
            router.push(returnTo);
            router.refresh();
          }
        }}
        onClose={closeAuthPrompt}
      />
    </AuthPromptContext.Provider>
  );
}

function normalizeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return null;
  }

  return value;
}

export function useAuthPrompt(): AuthPromptContextValue {
  const context = useContext(AuthPromptContext);

  if (!context) {
    throw new Error("useAuthPrompt must be used within AuthPromptProvider.");
  }

  return context;
}
