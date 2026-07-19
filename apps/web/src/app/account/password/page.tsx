import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { buildNoIndexMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Şifre değiştir",
  "BabyLoop şifre değiştirme işlemi hesap güvenliği merkezinde tamamlanır."
);

export default function AccountPasswordPage() {
  redirect("/account/security#password");
}
