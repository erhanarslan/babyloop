import type { ReactNode } from "react";

import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";

type AnalyticsLayoutProps = {
  children: ReactNode;
};

export default function AnalyticsLayout({ children }: AnalyticsLayoutProps) {
  return <BackofficeAuthShell>{children}</BackofficeAuthShell>;
}
