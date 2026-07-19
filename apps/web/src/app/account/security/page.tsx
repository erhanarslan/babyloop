import { redirect } from "next/navigation";

export default function LegacyAccountSecurityPage() {
  redirect("/account/profile?section=security");
}
