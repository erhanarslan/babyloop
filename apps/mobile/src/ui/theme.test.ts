import { colors, radius, shadows } from "./theme";

describe("mobile theme tokens", () => {
  it("exposes BabyLoop brand colors", () => {
    expect(colors.background).toBe("#fff7f2");
    expect(colors.primary).toBe("#d75f3f");
    expect(colors.text).toBe("#2f2521");
  });

  it("keeps radius tokens ordered from small to large", () => {
    expect(radius.sm).toBeLessThan(radius.md);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(radius.lg).toBeLessThan(radius.xl);
  });

  it("defines a reusable card shadow token", () => {
    expect(shadows.card.elevation).toBeGreaterThan(0);
    expect(shadows.card.shadowOpacity).toBeGreaterThan(0);
  });
});
