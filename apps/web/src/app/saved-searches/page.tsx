import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { buildNoIndexMetadata } from "../../lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Kayıtlı aramalar",
  "BabyLoop kayıtlı arama sayfaları özel alandır ve indekslenmez."
);

export default function SavedSearchesPage() {
  redirect("/account/saved-searches");
}
