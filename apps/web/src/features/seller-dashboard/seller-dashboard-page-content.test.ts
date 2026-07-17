import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/seller-dashboard/seller-dashboard-page-content.tsx"), "utf8");

describe("SellerDashboardPageContent", () => {
  it("keeps the seller panel focused on summary and performance", () => {
    expect(source).toContain('type SellerSection = "summary" | "performance"');
    expect(source).not.toContain('label: "Mesajlar"');
    expect(source).not.toContain('label: "Favoriler"');
    expect(source).not.toContain('label: "Ayarlar"');
  });

  it("uses a clear Turkish label for contact seller intent metrics", () => {
    expect(source).toContain("İletişim talebi");
    expect(source).not.toContain("Mesaj niyeti");
  });
});
