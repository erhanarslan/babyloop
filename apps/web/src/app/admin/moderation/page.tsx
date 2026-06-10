import { redirect } from "next/navigation";

import { getBackofficeBaseUrl } from "../../../lib/backoffice";

export default function DeprecatedAdminModerationPage() {
  redirect(`${getBackofficeBaseUrl()}/moderation`);
}
