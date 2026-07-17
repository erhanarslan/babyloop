"use client";

import type { ReactNode } from "react";
import { AnalyticsProvider } from "../features/analytics/analytics-provider";
import { I18nProvider } from "../lib/i18n/i18n-provider";
import { ThemeProvider } from "../lib/theme/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
