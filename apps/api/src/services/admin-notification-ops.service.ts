import { childProfiles, savedSearches } from "@babyloop/database/schema";
import { and, count, eq, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export type AdminNotificationOpsPreview = {
  summary: {
    totalDraftCandidates: number;
    childLifecycleCandidates: number;
    savedSearchCandidates: number;
    draftOnly: true;
  };
  deliveryPolicy: {
    sendEnabled: false;
    queueEnabled: false;
    emailEnabled: false;
    pushEnabled: false;
    n8nEnabled: false;
    dedupRequired: true;
    frequencyLimitRequired: true;
  };
  channels: Array<{
    key: "in_app" | "email_draft" | "push_future" | "n8n_future";
    label: string;
    status: "draft_only" | "future";
    note: string;
  }>;
  nextSteps: string[];
  warning: string;
};

export async function getAdminNotificationOpsPreview(app: FastifyInstance): Promise<AdminNotificationOpsPreview> {
  const [childRows, savedSearchRows] = await Promise.all([
    app.db
      .select({ value: count() })
      .from(childProfiles)
      .where(and(eq(childProfiles.isActive, true), ne(childProfiles.notificationCadence, "off"))),
    app.db
      .select({ value: count() })
      .from(savedSearches)
      .where(eq(savedSearches.notificationsEnabled, true))
  ]);

  const childLifecycleCandidates = Number(childRows[0]?.value ?? 0);
  const savedSearchCandidates = Number(savedSearchRows[0]?.value ?? 0);

  return {
    summary: {
      totalDraftCandidates: childLifecycleCandidates + savedSearchCandidates,
      childLifecycleCandidates,
      savedSearchCandidates,
      draftOnly: true
    },
    deliveryPolicy: {
      sendEnabled: false,
      queueEnabled: false,
      emailEnabled: false,
      pushEnabled: false,
      n8nEnabled: false,
      dedupRequired: true,
      frequencyLimitRequired: true
    },
    channels: [
      {
        key: "in_app",
        label: "In-app",
        status: "draft_only",
        note: "Şu an yalnızca draft/preview üretimi var; gerçek notification create/send yok."
      },
      {
        key: "email_draft",
        label: "Email draft",
        status: "draft_only",
        note: "Email provider bağlanmadan önce subject/body/dedup politikası netleşmeli."
      },
      {
        key: "push_future",
        label: "Push",
        status: "future",
        note: "Push token ve cihaz izinleri mobile/web push paketinden sonra bağlanmalı."
      },
      {
        key: "n8n_future",
        label: "n8n hook",
        status: "future",
        note: "Webhook yalnızca delivery log + retry + idempotency sonrası açılmalı."
      }
    ],
    nextSteps: [
      "notification_delivery_logs schema ve admin audit bağlantısı",
      "dedup key ve frequency limit policy",
      "saved search match preview",
      "email provider sandbox integration",
      "n8n webhook idempotency token"
    ],
    warning:
      "Bu endpoint operasyonel önizlemedir. Email, push, n8n, queue veya in-app notification gönderimi yapmaz."
  };
}
