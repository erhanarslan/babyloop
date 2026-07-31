"use client";

import { createContext, useContext, type ReactNode } from "react";

export type BackofficeUiPermission = "dashboard_view" | "listing_view" | "profile_view" | "mutate";
export type BackofficeAccessMode = "preview" | "staff";

type BackofficeAccess = {
  accessMode: BackofficeAccessMode;
  can: (permission: BackofficeUiPermission) => boolean;
  isReadOnly: boolean;
  role: string;
};

const BackofficeAccessContext = createContext<BackofficeAccess | null>(null);

export function BackofficeAccessProvider({
  accessMode,
  children,
  role
}: {
  accessMode: BackofficeAccessMode;
  children: ReactNode;
  role: string;
}) {
  const normalizedRole = role.toLowerCase();
  const isReadOnly =
    accessMode === "preview" || normalizedRole === "backoffice_viewer";

  return (
    <BackofficeAccessContext.Provider value={{
      accessMode,
      isReadOnly,
      role: normalizedRole,
      can(permission) {
        if (!isReadOnly) return true;
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
