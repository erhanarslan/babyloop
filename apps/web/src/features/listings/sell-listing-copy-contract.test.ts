import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/features/listings/sell-listing-form.tsx"),
  "utf8"
);

describe("sell listing compact copy contract", () => {
  it("keeps image and AI guidance concise", () => {
    expect(source).toContain("En fazla 5 gerçek ürün fotoğrafı ekle.");
    expect(source).toContain("Katalog, render ve AI görselleri kabul edilmez.");
    expect(source).toContain("AI ile taslak");
    expect(source).toContain("Taslak oluştur");
    expect(source).not.toContain(
      "Yalnızca ilandaki gerçek ürüne ait kendi çektiğin fotoğraflar kabul edilir."
    );
    expect(source).not.toContain(
      "AI taslağı manuel ilan oluşturmayı engellemez ve sen onaylamadan yayın yapmaz."
    );
  });

  it("keeps the required image rule without repeating a long warning", () => {
    expect(source).toContain("En az bir gerçek ürün fotoğrafı zorunludur.");
    expect(source).not.toContain("Yayınlamadan önce bilgileri kontrol et.");
  });
});
