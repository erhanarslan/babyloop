import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/styles/70-web-ui-ux-closure.css"),
  "utf8"
);

describe("password change modal visual contract", () => {
  it("matches the opaque login modal treatment", () => {
    expect(css).toContain("BABYLOOP_PASSWORD_CHANGE_MODAL_LOGIN_PARITY_V2");
    expect(css).toContain(
      ".password-change-modal-content .auth-security-summary"
    );
    expect(css).toContain("display: none !important");
    expect(css).toContain("linear-gradient(135deg, #ff786d, #ef5e73)");
    expect(css).toContain("background: #fffdf9 !important");
  });
});
