import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const modalSource = readFileSync(
  join(process.cwd(), "src/features/auth/password-change-modal.tsx"),
  "utf8"
);
const layoutSource = readFileSync(
  join(process.cwd(), "src/components/ui/layout.tsx"),
  "utf8"
);
const routeSource = readFileSync(
  join(process.cwd(), "src/app/account/password/page.tsx"),
  "utf8"
);

describe("password change modal contract", () => {
  it("opens password actions in a global modal instead of navigating", () => {
    expect(modalSource).toContain('const PASSWORD_CHANGE_PATH = "/account/password"');
    expect(modalSource).toContain('closest<HTMLAnchorElement>("a[href]")');
    expect(modalSource).toContain("event.preventDefault()");
    expect(modalSource).toContain('role="dialog"');
    expect(modalSource).toContain("<ChangePasswordForm");
  });

  it("mounts the modal once in the shared site shell", () => {
    expect(layoutSource).toContain("PasswordChangeModalHost");
    expect(layoutSource).toContain(
      "<PasswordChangeModalHost apiBaseUrl={getApiBaseUrl()} />"
    );
  });

  it("redirects legacy direct password URLs into the modal-backed account view", () => {
    expect(routeSource).toContain('redirect("/account?changePassword=1")');
    expect(routeSource).not.toContain("<ChangePasswordForm");
  });
});
