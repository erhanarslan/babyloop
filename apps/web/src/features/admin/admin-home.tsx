"use client";

import Link from "next/link";

import { useI18n } from "../../lib/i18n/i18n-provider";

export function AdminHome() {
  const { dictionary } = useI18n();

  return (
    <section className="grid gap-4">
      <div className="empty-state">
        <h1>{dictionary.admin.title}</h1>
        <p>{dictionary.admin.description}</p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card/80 p-6">
        <h2>{dictionary.admin.moderation.title}</h2>
        <p>{dictionary.admin.moderation.description}</p>

        <div>
          <Link className="primary-link" href="/admin/moderation">
            {dictionary.admin.moderation.openCases}
          </Link>
        </div>
      </div>
    </section>
  );
}