import { EmailOpsPage } from "../../features/email/email-ops-page";

export const metadata = {
  title: "Email Ops | BabyLoop Backoffice"
};

export default function EmailPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  return <EmailOpsPage apiBaseUrl={apiBaseUrl} />;
}
