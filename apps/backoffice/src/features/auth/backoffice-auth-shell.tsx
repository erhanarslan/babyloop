"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "../../lib/api";
import {
  BACKOFFICE_AUTH_CHANGED_EVENT,
  fetchBackofficeMe,
  type BackofficeAuthMe,
} from "../../lib/auth-client";
import { BackofficeShell } from "../shell/backoffice-shell";
import { resolveSafeBackofficeNextPath } from "../../lib/safe-next-path";
import { BackofficeAccessProvider } from "./backoffice-access";
import type { BackofficeAccessMode } from "./backoffice-access";

type BackofficeAuthShellProps = {
  children: ReactNode;
};

type AuthState =
  | {
      status: "checking";
    }
  | {
      status: "unauthenticated";
    }
  | {
      status: "forbidden";
      auth: BackofficeAuthMe;
    }
  | {
      status: "authorized";
      auth: BackofficeAuthMe;
    }
  | {
      status: "error";
    };

const AUTH_CHECK_TIMEOUT_MS = 8000;

export function BackofficeAuthShell({ children }: BackofficeAuthShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const checkIdRef = useRef(0);
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });

  const checkAccess = useCallback(async () => {
    const checkId = checkIdRef.current + 1;
    checkIdRef.current = checkId;

    setAuthState({ status: "checking" });

    const nextState = await getBackofficeAuthState();

    if (checkIdRef.current !== checkId) {
      return;
    }

    setAuthState(nextState);
  }, []);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess, pathname]);

  useEffect(() => {
    if (authState.status !== "unauthenticated") {
      return;
    }

    const nextPath = resolveSafeBackofficeNextPath(
      `${pathname}${window.location.search}`,
    );
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [authState.status, pathname, router]);

  useEffect(() => {
    function handleAuthChange() {
      void checkAccess();
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }

    window.addEventListener(BACKOFFICE_AUTH_CHANGED_EVENT, handleAuthChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener(BACKOFFICE_AUTH_CHANGED_EVENT, handleAuthChange);
      window.removeEventListener("pageshow", handlePageShow);
      checkIdRef.current += 1;
    };
  }, [checkAccess]);

  if (authState.status === "checking") {
    return (
      <main className="login-page">
        <section className="auth-state-card" aria-busy="true" aria-live="polite">
          <p className="eyebrow">Backoffice erişimi</p>
          <h2>Erişim kontrol ediliyor</h2>
          <p>Backoffice oturumun ve yetkilerin doğrulanıyor.</p>
        </section>
      </main>
    );
  }

  if (authState.status === "unauthenticated") {
    return (
      <main className="login-page" aria-busy="true" aria-label="Backoffice giriş yönlendirmesi" />
    );
  }

  if (authState.status === "forbidden") {
    return (
      <main className="login-page">
        <section className="auth-state-card" role="status">
          <p className="eyebrow">Erişim reddedildi</p>
          <h2>Backoffice erişimin yok</h2>
          <p>
            Mevcut rol: <strong>{authState.auth.user.role}</strong>
          </p>
          <p>
            Backoffice erişimi yalnız admin/backoffice rolleriyle sınırlıdır.
            Güvenlik sınırı backend yetkilendirmesidir.
          </p>
        </section>
      </main>
    );
  }

  if (authState.status === "error") {
    return (
      <main className="login-page">
        <section className="auth-state-card" role="alert">
          <p className="eyebrow">Backoffice erişimi</p>
          <h2>Erişim kontrolü başarısız</h2>
          <p>Backoffice oturumun doğrulanamadı. Tekrar dene.</p>
          <button
            className="primary-action"
            type="button"
            onClick={() => void checkAccess()}
          >
            Tekrar dene
          </button>
        </section>
      </main>
    );
  }

  const accessMode = resolveBackofficeUiAccessMode(authState.auth);
  const readOnly =
    accessMode === "preview" ||
    authState.auth.user.role.toLowerCase() === "backoffice_viewer";

  if (readOnly && !isReadOnlyPathAllowed(pathname)) {
    return (
      <main className="login-page">
        <section className="auth-state-card" role="alert">
          <p className="eyebrow">
            {accessMode === "preview" ? "Tanıtım modu" : "Salt okunur erişim"}
          </p>
          <h2>Bu bölüm için yetkin yok</h2>
          <p>Bu rota salt okunur erişim kapsamının dışındadır.</p>
        </section>
      </main>
    );
  }

  return (
    <BackofficeAccessProvider
      accessMode={accessMode}
      role={authState.auth.user.role}
    >
      <BackofficeShell accessMode={accessMode} role={authState.auth.user.role}>
        {children}
      </BackofficeShell>
    </BackofficeAccessProvider>
  );
}

async function getBackofficeAuthState(): Promise<AuthState> {
  try {
    const auth = await withTimeout(
      fetchBackofficeMe(getApiBaseUrl()),
      AUTH_CHECK_TIMEOUT_MS,
    );

    if (!auth) {
      return {
        status: "unauthenticated",
      };
    }

    if (!isBackofficeUiPrincipal(auth)) {
      return {
        status: "forbidden",
        auth,
      };
    }

    return {
      status: "authorized",
      auth,
    };
  } catch {
    return {
      status: "error",
    };
  }
}

export function isBackofficeUiPrincipal(auth: BackofficeAuthMe): boolean {
  const role = auth.user.role.toLowerCase();

  if (auth.accessMode === "preview") {
    return role === "user";
  }

  return ["admin", "backoffice_viewer"].includes(role);
}

export function isReadOnlyPathAllowed(pathname: string): boolean {
  return pathname === "/" || pathname === "/listings" || pathname.startsWith("/listings/") ||
    pathname === "/profiles" || pathname.startsWith("/profiles/");
}

function resolveBackofficeUiAccessMode(
  auth: BackofficeAuthMe
): BackofficeAccessMode {
  return auth.accessMode === "preview" ? "preview" : "staff";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Backoffice auth check timed out."));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}
