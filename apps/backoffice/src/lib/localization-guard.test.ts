import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const guardedFiles = collectTsxFiles(join(process.cwd(), "src"));

const forbiddenVisiblePatterns = [
  />Profiles</u,
  /aria-label="Profiles"/u,
  /Search profiles by safety status/u,
  />Safety status</u,
  />Risk level</u,
  /"All statuses"/u,
  /"All risk levels"/u,
  /"Highest risk first"/u,
  />Apply filters</u,
  /"Location not provided"/u,
  /No trust snapshot has been computed/u,
  />View profile detail</u,
  />Moderation cases</u,
  /Review reported listings/u,
  />Target type</u,
  /No cases found/u,
  />Audit events</u,
  />Event type</u,
  />Entity type</u,
  />Safe search</u,
  />Newest first</u,
  />Actor profile</u,
  />Previous Status</u,
  />Next Status</u,
  />Open listing</u,
  />Status controls</u,
  /"Archive listing"/u,
  />Action reason</u,
  />Apply listing action</u,
  />Seller summary</u,
  />Display name</u,
  />Images awaiting review</u,
  /Approve or reject individual listing images/u,
  /images awaiting review in this listing/u,
  /Image review audited/u,
  />Trust snapshot</u,
  />Operational stats</u,
  />Recent listings</u,
  />Related moderation cases</u,
  />Sensitive access</u,
  />Redacted summary</u,
  /Safe operational signals for this case/u,
  /Reports 7d/u,
  /Reports 30d/u,
  /profile risk/u,
  /% confidence/u,
  /<h2>Case /u,
  /Message preview:/u,
  /Back to cases/u,
  /Continue review/u,
  />Storage Ops Preview</u,
  /title: "Storage Ops/u,
  /title: "Notification Ops/u,
  /title: "Email Ops/u,
  /aria-label="Backoffice navigation"/u,
  />Worker sağlığı</u,
  />Provider</u,
  />Limit</u,
  />Back to profiles</u,
  /Could not load/u,
  /Enter a reason with at least/u,
  /No timeline events match/u,
  /Loading AI summary history/u,
  /No AI summaries have been generated/u,
  /Internal server error/u
];

describe("backoffice localization guard", () => {
  it("rejects known English user-facing copy while allowing technical product names", () => {
    const source = guardedFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const pattern of forbiddenVisiblePatterns) {
      expect(source, `Kullanıcı metni Türkçe olmalı: ${pattern.source}`).not.toMatch(pattern);
    }
    // Technical product names (RAG, Qdrant, Redis, Resend, OAuth, MFA, API, Google)
    // are intentionally outside the narrow user-copy denylist above.
  });
});

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(absolutePath);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
      ? [absolutePath]
      : [];
  });
}
