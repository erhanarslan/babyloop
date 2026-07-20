"use client";

import type { ReactNode } from "react";
import { AnalyticsProvider } from "../features/analytics/analytics-provider";
import { LegalConsentProvider } from "../features/legal/legal-consent";
import { I18nProvider } from "../lib/i18n/i18n-provider";
import { ThemeProvider } from "../lib/theme/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <LegalConsentProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </LegalConsentProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
