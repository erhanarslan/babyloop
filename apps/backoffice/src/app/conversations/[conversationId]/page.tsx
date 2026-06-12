import { BackofficeAuthShell } from "../../../features/auth/backoffice-auth-shell";
import { ConversationAdminDetail } from "../../../features/conversations/conversation-admin-detail";

type BackofficeConversationDetailPageProps = {
  params: {
    conversationId: string;
  };
};

export default function BackofficeConversationDetailPage({
  params,
}: BackofficeConversationDetailPageProps) {
  return (
    <BackofficeAuthShell>
      <ConversationAdminDetail conversationId={params.conversationId} />
    </BackofficeAuthShell>
  );
}
