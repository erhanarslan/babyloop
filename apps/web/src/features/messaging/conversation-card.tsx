"use client";

import Link from "next/link";
import type { ConversationSummary } from "./api";

type ConversationCardProps = {
  conversation: ConversationSummary;
  currentProfileId?: string | null;
  href?: string | undefined;
  isSelected?: boolean;
  isUnread?: boolean;
};

export function ConversationCard({
  conversation,
  currentProfileId,
  href,
  isSelected = false,
  isUnread = false
}: ConversationCardProps) {
  const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;
  const latestMessage = conversation.latestMessage?.body?.trim() ?? "";
  const previewPrefix =
    conversation.latestMessage?.senderProfileId && conversation.latestMessage.senderProfileId === currentProfileId
      ? "Sen: "
      : "";
  const unreadCount = Math.max(conversation.unreadCount, isUnread ? 1 : 0);
  const statusLabel = conversation.contextListing ? "İlan" : "Kapalı";
  const initials = getInitials(conversation.otherProfile.displayName);

  return (
    <Link
      aria-current={isSelected ? "page" : undefined}
      className={[
        "group flex gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-white/95 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:hover:bg-neutral-900/80",
        isSelected ? "border-rose-300 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/25" : "border-border bg-white/75 dark:bg-neutral-950/60",
        isUnread ? "shadow-[inset_3px_0_0_rgba(244,99,99,0.85)]" : ""
      ].join(" ")}
      href={href ?? `/conversations/${conversation.id}`}
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-teal-100 text-sm font-black text-neutral-800 dark:from-rose-900/50 dark:to-teal-900/50 dark:text-neutral-100"
      >
        {initials}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-foreground">
              {conversation.otherProfile.displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
              {conversation.contextListing?.title ?? "İlan bilgisi yok"}
            </span>
          </span>
          <time className="shrink-0 text-[0.72rem] font-semibold text-muted-foreground">
            {formatInboxTime(timestamp)}
          </time>
        </span>

        <span className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {latestMessage ? `${previewPrefix}${latestMessage}` : "Henüz mesaj yok"}
          </span>
          {unreadCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[0.68rem] font-black text-white">
              {unreadCount}
            </span>
          ) : null}
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-full px-2 py-1 text-[0.68rem] font-black",
              unreadCount > 0
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
            ].join(" ")}
          >
            {unreadCount > 0 ? "Yeni" : "Okundu"}
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-[0.68rem] font-black text-muted-foreground">
            {statusLabel}
          </span>
        </span>
      </span>
    </Link>
  );
}

function formatInboxTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "BL";
  }

  return parts.map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "").join("");
}
