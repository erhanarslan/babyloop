import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/features/messaging/conversations-page-content.tsx"),
  "utf8"
);

describe("conversations start panel", () => {
  it("shows a structured desktop state when no conversation is selected", () => {
    expect(source).toContain("<MessagesStartPanel />");
    expect(source).toContain("Bir konuşma seç");
    expect(source).toContain("Soldaki listeden bir konuşmayı aç.");
    expect(source).toContain('href="/browse"');
  });

  it("keeps the start panel concise and points to safe messaging", () => {
    expect(source).toContain("Yeni konuşmalar ilan detayındaki");
    expect(source).toContain("Yazışmayı BabyLoop içinde tut.");
    expect(source).not.toContain("Lorem");
  });

  it("keeps mobile list-first behavior", () => {
    expect(source).toContain(
      "messages-p0-empty-panel messages-start-panel hidden"
    );
    expect(source).toContain(
      'hasSelectedConversation ? "hidden lg:block" : ""'
    );
  });
});
