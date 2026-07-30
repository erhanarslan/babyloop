"use client";

import { createContext, useContext, type ReactNode } from "react";

export type BackofficeUiPermission = "dashboard_view" | "listing_view" | "profile_view" | "mutate";

const BackofficeAccessContext = createContext<{ role: string; can: (permission: BackofficeUiPermission) => boolean } | null>(null);

export function BackofficeAccessProvider({ children, role }: { children: ReactNode; role: string }) {
  const normalizedRole = role.toLowerCase();
  const viewer = normalizedRole === "backoffice_viewer";

  return (
    <BackofficeAccessContext.Provider value={{
      role: normalizedRole,
      can(permission) {
        if (!viewer) return true;
        return permission === "dashboard_view" || permission === "listing_view" || permission === "profile_view";
      },
    }}>
      {children}
    </BackofficeAccessContext.Provider>
  );
}

export function useBackofficeAccess() {
  const access = useContext(BackofficeAccessContext);
  if (!access) throw new Error("Backoffice access context is missing.");
  return access;
}
