import { colors, radius, shadows } from "./theme";

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
  });

  it("keeps radius tokens ordered from small to large", () => {
    expect(radius.sm).toBeLessThan(radius.md);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(radius.xl).toBeGreaterThan(radius.md);
  });

  it("defines reusable card shadow primitives without becoming visually heavy", () => {
    expect(shadows.card.elevation).toBeGreaterThan(0);
    expect(shadows.card.shadowOpacity).toBeGreaterThan(0);
    expect(shadows.card.shadowOpacity).toBeLessThan(0.2);
  });
});
