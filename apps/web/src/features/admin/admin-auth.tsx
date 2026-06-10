"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AUTH_CHANGED_EVENT,
  authFetch,
  type AuthMe,
} from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AdminAuthProps = {
  apiBaseUrl: string;
  children: ReactNode;
};

type AdminAuthState =
  | {
      status: "checking";
    }
  | {
      status: "unauthenticated";
    }
  | {
      status: "forbidden";
      auth: AuthMe;
    }
  | {
      status: "authorized";
      auth: AuthMe;
    }
  | {
      status: "error";
    };

const ADMIN_AUTH_TIMEOUT_MS = 8000;

export function AdminAuth({ apiBaseUrl, children }: AdminAuthProps) {
  const { dictionary } = useI18n();
  const pathname = usePathname();
  const checkIdRef = useRef(0);
  const [authState, setAuthState] = useState<AdminAuthState>({
    status: "checking",
  });

  const checkAdminAccess = useCallback(async () => {
    const checkId = checkIdRef.current + 1;
    checkIdRef.current = checkId;

    setAuthState({ status: "checking" });

    const nextState = await getAdminAuthState(apiBaseUrl);

    if (checkIdRef.current !== checkId) {
      return;
    }

    setAuthState(nextState);
  }, [apiBaseUrl]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    void checkAdminAccess();
  }, [checkAdminAccess, pathname]);

  useEffect(() => {
    function handleAuthChange() {
      void checkAdminAccess();
    }

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
      checkIdRef.current += 1;
    };
  }, [checkAdminAccess]);

  if (authState.status === "checking") {
    return (
      <section className="page-section" aria-busy="true" aria-live="polite">
        <div className="empty-state">
          <h1>{dictionary.admin.auth.checkingTitle}</h1>
          <p>{dictionary.admin.auth.checkingBody}</p>
          <p>
            <button
              className="secondary-link"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload admin access check
            </button>
          </p>
        </div>
      </section>
    );
  }

  if (authState.status === "unauthenticated") {
    return (
      <section className="page-section">
        <div className="empty-state" role="status">
          <h1>{dictionary.admin.auth.requiredTitle}</h1>
          <p>{dictionary.admin.auth.requiredBody}</p>
          <Link className="primary-link" href="/login">
            {dictionary.admin.auth.signIn}
          </Link>
        </div>
      </section>
    );
  }

  if (authState.status === "forbidden") {
    return (
      <section className="page-section">
        <div className="empty-state" role="status">
          <h1>{dictionary.admin.auth.forbiddenTitle}</h1>
          <p>{dictionary.admin.auth.forbiddenBody}</p>
          <p>
            {dictionary.admin.auth.currentRole}:{" "}
            <strong>{authState.auth.user.role}</strong>
          </p>
          <Link className="secondary-link" href="/">
            {dictionary.admin.backToMarketplace}
          </Link>
        </div>
      </section>
    );
  }

  if (authState.status === "error") {
    return (
      <section className="page-section">
        <div className="empty-state" role="alert">
          <h1>{dictionary.admin.auth.checkFailedTitle}</h1>
          <p>{dictionary.admin.auth.checkFailedBody}</p>
          <button
            className="primary-link"
            type="button"
            onClick={() => void checkAdminAccess()}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}

async function getAdminAuthState(apiBaseUrl: string): Promise<AdminAuthState> {
  try {
    const auth = await withTimeout(fetchMe(apiBaseUrl), ADMIN_AUTH_TIMEOUT_MS);

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

async function fetchMe(apiBaseUrl: string): Promise<AuthMe | null> {
  const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");

  if (response.status === 401) {
    return null;
  }

  const body = (await response.json()) as ApiResponse<AuthMe>;

  return response.ok && body.ok ? body.data : null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Admin auth check timed out."));
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