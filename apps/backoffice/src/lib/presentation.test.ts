import { describe, expect, it } from "vitest";

import { formatDateTimeTr, formatEnumLabel, formatMaskedReference } from "./presentation";

describe("backoffice presentation helpers", () => {
  it("maps domain enum values to Turkish labels", () => {
    expect(formatEnumLabel("sale")).toBe("Satılık");
    expect(formatEnumLabel("like_new")).toBe("Yeni gibi");
    expect(formatEnumLabel("active")).toBe("Aktif");
    expect(formatEnumLabel("reserved")).toBe("Rezerve");
  });

  it("formats dates consistently in the Istanbul timezone", () => {
    expect(formatDateTimeTr("2026-07-31T21:30:00.000Z")).toContain("1 Ağu 2026");
  });

  it("masks provider references", () => {
    expect(formatMaskedReference("provider-message-reference")).toBe("provi…ence");
  });
});
