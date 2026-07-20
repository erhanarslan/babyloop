import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { buildWebUrl } from "../../config/web";

const { readFileSync } = jest.requireActual("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { join } = jest.requireActual("node:path") as {
  join(...paths: string[]): string;
};

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("mobile legal public trust contract", () => {
  it("sends the current terms version only after a checked acceptance", () => {
    const register = read("src/features/auth/register-screen.tsx");

    expect(register).toContain("if (!termsAccepted)");
    expect(register).toContain("termsAccepted: true");
    expect(register).toContain("termsVersion: CURRENT_TERMS_VERSION");
    expect(register).toContain('accessibilityRole="checkbox"');
  });

  it("opens versioned legal and data-rights pages on the configured public web origin", () => {
    const legal = read("src/features/legal/legal-screen.tsx");
    const account = read("src/features/account/account-screen.tsx");

    expect(CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(buildWebUrl("/legal/terms")).toContain("/legal/terms");
    expect(legal).toContain("/legal/data-deletion");
    expect(legal).toContain("/support/contact");
    expect(account).toContain('href: "/legal"');
  });
});
