import { colors, radius, shadows, spacing } from "./theme";

describe("mobile theme tokens", () => {
  it("exposes BabyLoop brand colors", () => {
    expect(colors.background).toBe("#fff7f2");
    expect(colors.primary).toBe("#d75f3f");
    expect(colors.text).toBe("#2f2521");
  });

  it("keeps the BabyLoop pastel surface tokens stable", () => {
    expect(colors.background).toBe("#fff7f2");
    expect(colors.surface).toBe("#ffffff");
    expect(colors.primary).toBe("#d75f3f");
    expect(colors.primaryForeground).toBe("#ffffff");
    expect(colors.surfaceSoft).toBe("#fff1e8");
    expect(colors.cream).toBe("#ffe5d6");
    expect(colors.successSoft).toBe("#f0fdf4");
    expect(colors.warningSoft).toBe("#fff7e8");
    expect(colors.danger).toBe("#b42318");
  });

  it("keeps radius tokens ordered from small to large", () => {
    expect(radius.sm).toBeLessThan(radius.md);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(radius.lg).toBeLessThan(radius.xl);
    expect(radius.xl).toBeGreaterThan(radius.md);
  });

  it("defines reusable card shadow primitives without becoming visually heavy", () => {
    expect(shadows.card.shadowColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(shadows.card.elevation).toBeGreaterThan(0);
    expect(shadows.card.shadowOpacity).toBeGreaterThan(0);
    expect(shadows.card.shadowOpacity).toBeLessThan(0.2);
  });

  it("keeps spacing tokens on a predictable compact scale", () => {
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.lg);
    expect(spacing["2xl"]).toBeGreaterThan(spacing.xl);
  });
});
