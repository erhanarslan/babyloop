"use client";

import {
  createContext,
  useCallback,
  useContext,
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

          closeAuthPrompt();
          onAuthenticated?.(payload);
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
