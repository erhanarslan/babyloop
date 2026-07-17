"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "../../lib/api";
import {
  BACKOFFICE_AUTH_CHANGED_EVENT,
  fetchBackofficeMe,
  type BackofficeAuthMe,
} from "../../lib/auth-client";
import { BackofficeShell } from "../shell/backoffice-shell";

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
      <BackofficeShell>
        <section className="auth-state-card" aria-busy="true" aria-live="polite">
          <p className="eyebrow">Backoffice erişimi</p>
          <h2>Erişim kontrol ediliyor</h2>
          <p>Backoffice oturumun ve yetkilerin doğrulanıyor.</p>
        </section>
      </BackofficeShell>
    );
  }

  if (authState.status === "unauthenticated") {
    return (
      <BackofficeShell>
        <section className="auth-state-card" role="status">
          <p className="eyebrow">Backoffice erişimi gerekli</p>
          <h2>Giriş gerekli</h2>
          <p>BabyLoop Backoffice’e erişmeden önce giriş yapmalısın.</p>
          <Link className="primary-action" href="/login">
            Giriş yap
          </Link>
        </section>
      </BackofficeShell>
    );
  }

  if (authState.status === "forbidden") {
    return (
      <BackofficeShell>
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
      </BackofficeShell>
    );
  }

  if (authState.status === "error") {
    return (
      <BackofficeShell>
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
      </BackofficeShell>
    );
  }

  return <BackofficeShell>{children}</BackofficeShell>;
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

    if (auth.user.role !== "admin") {
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
