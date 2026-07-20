import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../ui/screen";
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileSkeleton
} from "../../ui/mobile-primitives";
import { colors, radius, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { useMobileConversationList } from "./conversation-list-store";
import type { MobileConversationSummary } from "./messages-api";

export function MessagesScreen() {
  const authSession = useAuthSession();
  const conversationList = useMobileConversationList();
  const { conversations, error, refresh, status } = conversationList;

  useFocusEffect(
    useCallback(() => {
      void refresh({ maxAgeMs: 15_000 });
    }, [refresh])
  );

  if (!authSession.currentUser) {
    return (
      <Screen title="Mesajlar">
        <MobileCard style={styles.stateStack}>
          <Text style={styles.stateTitle}>Hesap gerekli</Text>
          <Text style={styles.stateText}>Favoriler ve mesajlar hesabına bağlı tutulur.</Text>
          <Link href="/login" asChild>
            <MobileButton>Giriş yap</MobileButton>
          </Link>
        </MobileCard>
      </Screen>
    );
  }

  return (
    <Screen title="Mesajlar">
      {status === "loading" ? <MobileSkeleton label="Mesajlar yükleniyor..." /> : null}

      {status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void refresh()}
          title="Mesajlar yüklenemedi"
        />
      ) : null}

      {status === "ready" && conversations.length === 0 ? (
        <MobileEmptyState
          message="Satıcıya yazdığında konuşman burada görünür."
          title="Henüz konuşma yok"
        />
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{conversation.title.slice(0, 1).toLocaleUpperCase("tr-TR")}</Text>
          </View>
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
    gap: spacing.md
  },
  conversationCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "900"
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
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "900"
  },
  stateStack: {
    gap: spacing.sm
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
});
