import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, SectionHeader } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { fetchMobileConversations, type MobileConversationSummary } from "./messages-api";

type MessagesStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function MessagesScreen() {
  const authSession = useAuthSession();
  const [status, setStatus] = useState<MessagesStatus>("idle");
  const [conversations, setConversations] = useState<MobileConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!authSession.currentUser) {
      setConversations([]);
      setStatus("idle");
      return;
    }

    setStatus((current) => (current === "ready" ? current : "loading"));
    setError(null);

    try {
      const nextConversations = await fetchMobileConversations();
      setConversations(nextConversations);
      setStatus(nextConversations.length > 0 ? "ready" : "empty");
    } catch (nextError) {
      setConversations([]);
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "Mesajlar şu an yüklenemedi.");
    }
  }, [authSession.currentUser]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  if (!authSession.currentUser) {
    return (
      <Screen
        eyebrow="Mesajlar"
        title="Konuşmalar"
        subtitle="Satıcı ve alıcı mesajlarını görmek için giriş yap."
      >
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Mesajlar hesabına bağlıdır.</Text>
          <Text style={styles.stateText}>
            İlan detayından satıcıya yazdığında konuşmaların burada görünür.
          </Text>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            </Pressable>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Mesajlar"
      title="Konuşmalar"
      subtitle="İlanlarla ilgili alıcı ve satıcı mesajlarını takip et."
    >
      <SectionHeader
        title="Gelen kutusu"
        description="Satıcı bilgileri ve özel iletişim alanları burada gösterilmez."
      />

      <View style={styles.list}>
        {status === "loading" ? (
          <StateCard title="Mesajlar yükleniyor" text="Konuşmaların getiriliyor." />
        ) : null}

        {status === "error" ? (
          <StateCard
            actionLabel="Tekrar dene"
            onAction={loadConversations}
            title="Mesajlar yüklenemedi"
            text={error ?? "Kısa süre sonra tekrar deneyebilirsin."}
          />
        ) : null}

        {status === "empty" ? (
          <StateCard
            title="Mesajların burada görünecek."
            text="Bir ilan detayından satıcıya mesaj gönderdiğinde konuşma burada başlar."
          />
        ) : null}

        {conversations.map((conversation) => (
          <ConversationCard conversation={conversation} key={conversation.id} />
        ))}
      </View>

    </Screen>
  );
}

function ConversationCard({ conversation }: { conversation: MobileConversationSummary }) {
  return (
    <View style={styles.conversationCard}>
      <View style={styles.conversationHeader}>
        <View style={styles.conversationTitleBlock}>
          <Text numberOfLines={1} style={styles.conversationTitle}>
            {conversation.title}
          </Text>
          <Text numberOfLines={1} style={styles.conversationSubtitle}>
            {conversation.subtitle}
          </Text>
        </View>

        {conversation.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={2} style={styles.latestMessage}>
        {conversation.latestMessageText}
      </Text>

      {conversation.updatedAt ? (
        <Text style={styles.metaText}>{formatDate(conversation.updatedAt)}</Text>
      ) : null}
    </View>
  );
}

function StateCard({
  title,
  text,
  actionLabel,
  onAction
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDate(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsedDate);
}

const styles = StyleSheet.create({
  list: {
    gap: 12
  },
  conversationCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 15,
    gap: 10
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  conversationTitleBlock: {
    flex: 1,
    gap: 3
  },
  conversationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  conversationSubtitle: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: "700"
  },
  latestMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  metaText: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  stateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  }
});
