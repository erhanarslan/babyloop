import { redirect } from "next/navigation";

import { getBackofficeBaseUrl } from "../../../../lib/backoffice";

type DeprecatedAdminModerationCasePageProps = {
  params: {
    caseId: string;
  };
};

export default function DeprecatedAdminModerationCasePage({
  params,
}: DeprecatedAdminModerationCasePageProps) {
  redirect(`${getBackofficeBaseUrl()}/moderation/${params.caseId}`);
}
