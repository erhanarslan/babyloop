"use client";

import Link from "next/link";

import { useI18n } from "../../lib/i18n/i18n-provider";
import { ModerationCaseList } from "./moderation-case-list";

export function AdminModerationPageContent() {
  const { dictionary } = useI18n();

  return (
    <div className="grid gap-4">
      <div>
        <Link className="secondary-link" href="/admin">
          {dictionary.admin.backToAdmin}
        </Link>
      </div>

      <ModerationCaseList />
    </div>
  );
}