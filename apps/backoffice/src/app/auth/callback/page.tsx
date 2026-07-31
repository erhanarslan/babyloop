"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getApiBaseUrl } from "../../../lib/api";
import { fetchBackofficeMe } from "../../../lib/auth-client";
import { resolveSafeBackofficeNextPath } from "../../../lib/safe-next-path";

export default function BackofficeGoogleCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const params = new URLSearchParams(window.location.search);
      const nextPath = resolveSafeBackofficeNextPath(params.get("next"));
      if (params.get("status") !== "success") {
        router.replace(`/login?authError=google_auth_failed${nextPath === "/" ? "" : `&next=${encodeURIComponent(nextPath)}`}`);
        return;
      }

      try {
        const auth = await fetchBackofficeMe(getApiBaseUrl());
        if (!active) return;
        if (!auth) {
          router.replace(`/login?authError=session_establishment_failed${nextPath === "/" ? "" : `&next=${encodeURIComponent(nextPath)}`}`);
          return;
        }
        router.replace(nextPath);
      } catch {
        if (active) setFailed(true);
      }
    }

    void verifySession();
    return () => { active = false; };
  }, [router]);

  return (
    <main className="login-page">
      <section aria-busy={!failed} aria-live="polite" className="auth-state-card" role={failed ? "alert" : "status"}>
        <p className="eyebrow">Google ile giriş</p>
        <h1>{failed ? "Oturum doğrulanamadı" : "Oturum doğrulanıyor"}</h1>
        <p>{failed ? "Backoffice oturumu doğrulanamadı. Giriş ekranından tekrar dene." : "Güvenli backoffice oturumun kontrol ediliyor."}</p>
        {failed ? <button className="primary-action" onClick={() => router.replace("/login?authError=session_establishment_failed")} type="button">Girişe dön</button> : null}
      </section>
    </main>
  );
}
