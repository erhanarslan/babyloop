import type { MobileConversationDetail } from "./messages-api";

const MAX_MESSAGE_BODY_LENGTH = 500;

export type MobileConversationListingContextView = {
  title: string;
  subtitle: string;
  statusText: string | null;
  actionLabel: string;
  canOpenListing: boolean;
  tone: "neutral" | "warning" | "success";
};

export function getMobileConversationListingContext(
  conversation: MobileConversationDetail | null
): MobileConversationListingContextView | null {
  if (!conversation?.listingId) {
    return null;
  }

  const title = conversation.listingTitle?.trim() || "İlan detayı";
  const otherProfileName =
    conversation.otherProfileDisplayName?.trim() ||
    conversation.subtitle?.trim() ||
    "Diğer ebeveyn";
  const status = conversation.listingStatus?.trim().toLowerCase() ?? null;
  const statusText = getListingStatusText(status);
  const tone = status === "sold" || status === "archived" ? "warning" : status === "reserved" ? "warning" : "success";

  return {
    title,
    subtitle: getListingContextSubtitle({ otherProfileName, status }),
    statusText,
    actionLabel: "İlanı aç",
    canOpenListing: true,
    tone
  };
}

export function canSendMobileConversationMessage(input: {
  body: string;
  conversationId: string;
  sending: boolean;
}): boolean {
  const normalizedBody = input.body.trim();

  return (
    input.conversationId.trim().length > 0 &&
    normalizedBody.length > 0 &&
    normalizedBody.length <= MAX_MESSAGE_BODY_LENGTH &&
    !input.sending
  );
}

export function getMobileConversationMessageCharacterCount(body: string): {
  length: number;
  remaining: number;
  isOverLimit: boolean;
} {
  const length = body.length;

  return {
    length,
    remaining: MAX_MESSAGE_BODY_LENGTH - length,
    isOverLimit: length > MAX_MESSAGE_BODY_LENGTH
  };
}

function getListingContextSubtitle(input: {
  otherProfileName: string;
  status: string | null;
}): string {
  if (input.status === "reserved") {
    return `${input.otherProfileName} ile rezerve görünen bu ilan hakkında konuşuyorsun.`;
  }

  if (input.status === "sold") {
    return `${input.otherProfileName} ile bu ilan hakkında konuşuyorsun; ilan satılmış görünebilir.`;
  }

  if (input.status === "archived") {
    return `${input.otherProfileName} ile bu ilan hakkında konuşuyorsun; ilan yayında olmayabilir.`;
  }

  return `${input.otherProfileName} ile bu ilan için konuşuyorsun.`;
}

function getListingStatusText(status: string | null): string | null {
  if (status === "active") {
    return "Aktif";
  }

  if (status === "reserved") {
    return "Rezerve";
  }

  if (status === "sold") {
    return "Satıldı";
  }

  if (status === "archived") {
    return "Yayında değil";
  }

  return null;
}
