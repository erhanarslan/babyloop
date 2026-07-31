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
import {
  readAuthModalQuery,
  removeAuthModalQuery,
  type AuthModalErrorCode
} from "./auth-modal-query";
import type { AuthMode } from "./api";

type AuthPromptOptions = {
  initialErrorCode?: AuthModalErrorCode | null;
  initialMode?: AuthMode;
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

    const currentUrl = new URL(window.location.href);
    const nextSearchParams = removeAuthModalQuery(currentUrl.searchParams);

    if (nextSearchParams.toString() === currentUrl.searchParams.toString()) {
      return;
    }

    const nextSearch = nextSearchParams.toString();
    const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ""}${currentUrl.hash}`;
    router.replace(nextUrl || "/", { scroll: false });
  }, [router]);

  const openAuthPrompt = useCallback((options: AuthPromptOptions = {}) => {
    const nextOptions: AuthPromptOptions = {
      title: options.title ?? DEFAULT_AUTH_TITLE
    };

    if (options.returnTo) {
      nextOptions.returnTo = options.returnTo;
    }

    if (options.initialMode) {
      nextOptions.initialMode = options.initialMode;
    }

    if (options.initialErrorCode) {
      nextOptions.initialErrorCode = options.initialErrorCode;
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
    const authQuery = readAuthModalQuery(currentUrl.searchParams);

    if (!authQuery) {
      return;
    }

    const title = authQuery.passwordChanged
      ? "Şifren değişti, yeniden giriş yap"
      : authQuery.errorCode
        ? "Giriş tamamlanamadı, tekrar dene"
        : DEFAULT_AUTH_TITLE;

    openAuthPrompt({
      initialErrorCode: authQuery.errorCode,
      initialMode: authQuery.mode,
      title,
      ...(authQuery.returnTo ? { returnTo: authQuery.returnTo } : {})
    });
  }, [openAuthPrompt]);

  return (
    <AuthPromptContext.Provider value={value}>
      {children}

      <AuthActionPromptModal
        apiBaseUrl={apiBaseUrl}
        {...(promptOptions?.initialErrorCode !== undefined
          ? { initialErrorCode: promptOptions.initialErrorCode }
          : {})}
        {...(promptOptions?.initialMode
          ? { initialMode: promptOptions.initialMode }
          : {})}
        isOpen={Boolean(promptOptions)}
        title={promptOptions?.title ?? DEFAULT_AUTH_TITLE}
        returnTo={promptOptions?.returnTo}
        onAuthenticated={(payload) => {
          const onAuthenticated = promptOptions?.onAuthenticated;
          const returnTo = promptOptions?.returnTo;

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

export function useAuthPrompt(): AuthPromptContextValue {
  const context = useContext(AuthPromptContext);

  if (!context) {
    throw new Error("useAuthPrompt must be used within AuthPromptProvider.");
  }

  return context;
}
