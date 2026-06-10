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
          <p className="eyebrow">Backoffice access</p>
          <h2>Checking access</h2>
          <p>Validating your backoffice session and permissions.</p>
        </section>
      </BackofficeShell>
    );
  }

  if (authState.status === "unauthenticated") {
    return (
      <BackofficeShell>
        <section className="auth-state-card" role="status">
          <p className="eyebrow">Backoffice access required</p>
          <h2>Sign in required</h2>
          <p>You need to sign in before accessing BabyLoop Backoffice.</p>
          <Link className="primary-action" href="/login">
            Sign in
          </Link>
        </section>
      </BackofficeShell>
    );
  }

  if (authState.status === "forbidden") {
    return (
      <BackofficeShell>
        <section className="auth-state-card" role="status">
          <p className="eyebrow">Access denied</p>
          <h2>You do not have backoffice access</h2>
          <p>
            Current role: <strong>{authState.auth.user.role}</strong>
          </p>
          <p>
            Backoffice access is restricted to admin/backoffice roles. Backend
            authorization remains the security boundary.
          </p>
        </section>
      </BackofficeShell>
    );
  }

  if (authState.status === "error") {
    return (
      <BackofficeShell>
        <section className="auth-state-card" role="alert">
          <p className="eyebrow">Backoffice access</p>
          <h2>Access check failed</h2>
          <p>Could not verify your backoffice session. Try again.</p>
          <button
            className="primary-action"
            type="button"
            onClick={() => void checkAccess()}
          >
            Retry
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
