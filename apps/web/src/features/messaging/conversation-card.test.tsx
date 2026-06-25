import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConversationCard } from "./conversation-card";
import type { ConversationSummary } from "./api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

const conversation: ConversationSummary = {
  id: "conversation-1",
  otherProfile: {
    id: "profile-private-id",
    displayName: "Ayşe Demir"
  },
  contextListing: {
    id: "listing-1",
    title: "Temiz bebek arabası"
  },
  latestMessage: {
    body: "<script>alert('x')</script> Merhaba",
    createdAt: "2026-06-20T10:00:00.000Z",
    senderProfileId: "profile-other"
  },
  unreadCount: 2,
  status: "active",
  lastMessageAt: "2026-06-20T10:00:00.000Z",
  createdAt: "2026-06-20T09:00:00.000Z",
  updatedAt: "2026-06-20T10:00:00.000Z"
};

describe("ConversationCard", () => {
  it("renders safe public conversation data only", () => {
    render(<ConversationCard conversation={conversation} currentProfileId="profile-current" />);

    expect(screen.getByText("Ayşe Demir")).toBeInTheDocument();
    expect(screen.getByText("Temiz bebek arabası")).toBeInTheDocument();
    expect(screen.getByText("<script>alert('x')</script> Merhaba")).toBeInTheDocument();
    expect(screen.queryByText("profile-private-id")).not.toBeInTheDocument();
    expect(screen.queryByText("profile-other")).not.toBeInTheDocument();
  });

  it("prefixes current profile messages as self without exposing profile id", () => {
    render(
      <ConversationCard
        conversation={{
          ...conversation,
          latestMessage: {
            ...conversation.latestMessage!,
            senderProfileId: "profile-current",
            body: "Fiyat son mu?"
          }
        }}
        currentProfileId="profile-current"
      />
    );

    expect(screen.getByText("Sen: Fiyat son mu?")).toBeInTheDocument();
    expect(screen.queryByText("profile-current")).not.toBeInTheDocument();
  });
});
