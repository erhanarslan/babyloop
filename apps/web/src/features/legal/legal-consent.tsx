"use client";

import Link from "next/link";
import { Button } from "../../components/ui";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const LEGAL_ANALYTICS_CONSENT_KEY = "babyloop.legal.analytics-consent.v1";
const ANALYTICS_CONSENT_CHANGED_EVENT = "babyloop-analytics-consent-changed";

type AnalyticsConsent = "accepted" | "rejected" | "unset";

type LegalConsentContextValue = {
  analyticsConsent: AnalyticsConsent;
  analyticsEnabled: boolean;
  openPreferences: () => void;
  setAnalyticsConsent: (value: Exclude<AnalyticsConsent, "unset">) => void;
};

const LegalConsentContext = createContext<LegalConsentContextValue | null>(null);

export function LegalConsentProvider({ children }: { children: ReactNode }) {
  const [analyticsConsent, setAnalyticsConsentState] = useState<AnalyticsConsent>("unset");
  const [hydrated, setHydrated] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(LEGAL_ANALYTICS_CONSENT_KEY);
    setAnalyticsConsentState(stored === "accepted" || stored === "rejected" ? stored : "unset");
    setHydrated(true);
  }, []);

  const setAnalyticsConsent = useCallback((value: "accepted" | "rejected") => {
    window.localStorage.setItem(LEGAL_ANALYTICS_CONSENT_KEY, value);
    setAnalyticsConsentState(value);
    setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_CHANGED_EVENT, { detail: value }));
  }, []);

  const value = useMemo<LegalConsentContextValue>(() => ({
    analyticsConsent,
    analyticsEnabled: hydrated && analyticsConsent === "accepted",
    openPreferences: () => setPreferencesOpen(true),
    setAnalyticsConsent
  }), [analyticsConsent, hydrated, setAnalyticsConsent]);

  return (
    <LegalConsentContext.Provider value={value}>
      {children}
      {hydrated ? (
        <CookieConsentSurface
          analyticsConsent={analyticsConsent}
          open={analyticsConsent === "unset" || preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
          onSelect={setAnalyticsConsent}
        />
      ) : null}
    </LegalConsentContext.Provider>
  );
}

export function useLegalConsent(): LegalConsentContextValue {
  const context = useContext(LegalConsentContext);

  if (!context) {
    throw new Error("useLegalConsent must be used within LegalConsentProvider.");
  }

  return context;
}

function CookieConsentSurface({
  analyticsConsent,
  onClose,
  onSelect,
  open
}: {
  analyticsConsent: AnalyticsConsent;
  onClose: () => void;
  onSelect: (value: "accepted" | "rejected") => void;
  open: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!open) {
    return null;
  }

  return (
    <section className="cookie-consent" aria-label="Çerez ve analitik tercihleri" role="dialog" aria-modal="false">
      <div className="cookie-consent-copy">
        <p className="eyebrow">Gizlilik tercihi</p>
        <h2>Analitik kontrolü sende</h2>
        <p>
          Zorunlu oturum ve güvenlik teknolojileri hizmet için çalışır. Birinci taraf ürün analitiği ise
          yalnızca izin verirsen başlar. Mesaj, şifre veya çocuk notu analitik olarak gönderilmez.
        </p>
        <p className="cookie-consent-links">
          <Link href="/legal/cookies">Çerez politikası</Link>
          <Link href="/legal/kvkk">KVKK aydınlatması</Link>
        </p>
      </div>

      {showDetails ? (
        <div className="cookie-consent-details">
          <div>
            <strong>Zorunlu</strong>
            <span>Oturum, CSRF, OAuth, tema/dil/şehir ve tercih kaydı. Her zaman açık.</span>
          </div>
          <div>
            <strong>Analitik</strong>
            <span>Sayfa/ekran, süre kovası ve ürün etkileşimi. Varsayılan kapalı.</span>
          </div>
        </div>
      ) : null}

      <div className="cookie-consent-actions">
        <Button type="button" variant="secondary" onClick={() => onSelect("rejected")}>İsteğe bağlıları reddet</Button>
        <Button type="button" variant="secondary" onClick={() => setShowDetails((value) => !value)}>Tercihler</Button>
        <Button type="button" onClick={() => onSelect("accepted")}>Analitiğe izin ver</Button>
        {analyticsConsent !== "unset" ? (
          <button className="cookie-consent-close" type="button" onClick={onClose}>Kapat</button>
        ) : null}
      </div>
    </section>
  );
}
