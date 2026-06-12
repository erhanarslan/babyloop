import { BackofficeAuthShell } from "../../features/auth/backoffice-auth-shell";
import { ConversationAdminList } from "../../features/conversations/conversation-admin-list";

export default function BackofficeConversationsPage() {
  return (
    <BackofficeAuthShell>
      <ConversationAdminList />
    </BackofficeAuthShell>
  );
}
