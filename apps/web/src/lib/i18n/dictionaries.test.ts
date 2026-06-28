import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

describe("web i18n dictionaries", () => {
  it("keeps Turkish and English dictionary shapes aligned", () => {
    expect(collectDictionaryPaths(dictionaries.tr).sort()).toEqual(collectDictionaryPaths(dictionaries.en).sort());
  });
});

function collectDictionaryPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectDictionaryPaths(item, `${prefix}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      collectDictionaryPaths(child, prefix ? `${prefix}.${key}` : key)
    );
  }

  return [prefix];
}
