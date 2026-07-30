export const BACKOFFICE_VIEWER_ROLE = "backoffice_viewer";

const PROTECTED_BACKOFFICE_ROLES = new Set(["admin", "moderator", "support"]);
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertViewerRoleTransition(currentRole: string, mode: "assign" | "revoke"): string {
  const normalizedRole = currentRole.trim().toLowerCase();

  if (PROTECTED_BACKOFFICE_ROLES.has(normalizedRole)) {
    throw new Error("Protected backoffice roles cannot be overwritten by the viewer operator.");
  }

  if (mode === "assign") {
    if (normalizedRole !== "user" && normalizedRole !== BACKOFFICE_VIEWER_ROLE) {
      throw new Error("Only a normal user can be assigned the backoffice viewer role.");
    }
    return BACKOFFICE_VIEWER_ROLE;
  }

  if (normalizedRole !== BACKOFFICE_VIEWER_ROLE) {
    throw new Error("Only a backoffice viewer can be revoked by this operator.");
  }
  return "user";
}

export function maskOperatorEmail(email: string): string {
  const [localPart = "", domain = ""] = email.split("@");
  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function assertViewerOperatorApplyGuard(input: {
  apply: boolean;
  confirmation: string | undefined;
  databaseUrl: string | undefined;
  environment: string;
}): void {
  if (!input.apply) return;

  if (input.environment === "production") {
    if (input.confirmation !== "ASSIGN_BACKOFFICE_VIEWER_PRODUCTION") {
      throw new Error("Production apply requires the exact viewer assignment confirmation.");
    }
    return;
  }

  if (input.environment !== "local") {
    throw new Error("Viewer operator apply is allowed only for local or explicitly confirmed production targets.");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.databaseUrl ?? "");
  } catch {
    throw new Error("Local viewer operator apply requires a valid DATABASE_URL.");
  }

  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (
    !LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase()) ||
    !["babyloop_dev", "babyloop_test"].includes(database)
  ) {
    throw new Error("Local viewer operator apply requires a loopback BabyLoop development or test database.");
  }
}
