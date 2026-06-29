import { BackofficeAuthShell } from "../../../features/auth/backoffice-auth-shell";
import { ConversationAdminDetail } from "../../../features/conversations/conversation-admin-detail";

type BackofficeConversationDetailPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default async function BackofficeConversationDetailPage({
  params,
}: BackofficeConversationDetailPageProps) {
  const { conversationId } = await params;

  return (
    <BackofficeAuthShell>
      <ConversationAdminDetail conversationId={conversationId} />
    </BackofficeAuthShell>
  );
}
