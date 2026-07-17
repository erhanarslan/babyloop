import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(
  join(process.cwd(), "src/features/conversations/conversation-admin-detail.tsx"),
  "utf8"
);
const listSource = readFileSync(
  join(process.cwd(), "src/features/conversations/conversation-admin-list.tsx"),
  "utf8"
);

describe("conversation admin copy", () => {
  it("keeps message review surfaces in Turkish operational language", () => {
    const combined = `${detailSource}\n${listSource}`;

    expect(combined).toContain("Mesaj inceleme");
    expect(combined).toContain("Mesajlara dön");
    expect(combined).toContain("Konuşmayı incele");
    expect(combined).not.toContain("Back to messages");
    expect(combined).not.toContain("Review conversation");
    expect(combined).not.toContain("Loading conversation");
  });
});
