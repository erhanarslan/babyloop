import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileConversations,
  type MobileConversationSummary
} from "./messages-api";

const CONVERSATION_LIST_POLL_INTERVAL_MS = 4000;

export function MessagesScreen() {
  const authSession = useAuthSession();
  const [conversations, setConversations] = useState<MobileConversationSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!authSession.currentUser) {
        setConversations([]);
        setStatus("ready");
        setError(null);
        return;
      }

      try {
        if (!options.silent) {
          setStatus("loading");
        }

        const nextConversations = await fetchMobileConversations();

        setConversations(nextConversations);
        setStatus("ready");
        setError(null);
      } catch (nextError) {
        if (!options.silent) {
          setStatus("error");
          setError(nextError instanceof Error ? nextError.message : "Mesajlar şu an yüklenemedi.");
        }
      }
    },
    [authSession.currentUser]
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!authSession.currentUser) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadConversations({ silent: true });
    }, CONVERSATION_LIST_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [authSession.currentUser, loadConversations]);

  if (!authSession.currentUser) {
    return (
      <Screen
        eyebrow="Mesajlar"
        title="Konuşmalar"
        subtitle="Satıcılarla güvenli mesajlaşmak için giriş yap."
      >
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Hesap gerekli</Text>
          <Text style={styles.stateText}>Favoriler ve mesajlar hesabına bağlı tutulur.</Text>
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
      subtitle="İlanlarla ilgili soruları ve yanıtları burada takip et."
    >
      {status === "loading" ? <Paragraph>Konuşmalar yükleniyor...</Paragraph> : null}

      {status === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Mesajlar yüklenemedi</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable onPress={() => void loadConversations()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "ready" && conversations.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Henüz konuşma yok</Text>
          <Text style={styles.stateText}>Bir ilandan “Satıcıya yaz” dediğinde konuşma burada görünür.</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {conversations.map((conversation) => (
          <ConversationCard conversation={conversation} key={conversation.id} />
        ))}
      </View>
    </Screen>
  );
}

function ConversationCard({ conversation }: { conversation: MobileConversationSummary }) {
  return (
    <Link href={`/conversation/${encodeURIComponent(conversation.id)}`} asChild>
      <Pressable style={styles.conversationCard}>
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
          <Text style={styles.updatedAt}>{formatDate(conversation.updatedAt)}</Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short"
  });
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
    padding: 14,
    gap: 10
  },
  conversationHeader: {
    flexDirection: "row",
    gap: 10
  },
  conversationTitleBlock: {
    flex: 1,
    gap: 3
  },
  conversationTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  conversationSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  latestMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  updatedAt: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700"
  },
  unreadBadge: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 7
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
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  }
});
