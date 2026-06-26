
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Paragraph, Screen } from "../../ui/screen";
import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileConversationDetail,
  fetchMobileConversationMessages,
  sendMobileConversationMessage,
  type MobileConversationDetail,
  type MobileConversationMessage
} from "./messages-api";

type DetailStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function ConversationDetailScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const router = useRouter();
  const authSession = useAuthSession();
  const currentProfileId = authSession.currentUser?.profile.id ?? null;
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";

  const [conversation, setConversation] = useState<MobileConversationDetail | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [status, setStatus] = useState<DetailStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const loadConversation = useCallback(async () => {
    if (!authSession.currentUser) {
      setStatus("empty");
      return;
    }

    if (!conversationId) {
      setStatus("error");
      setError("Konuşma bilgisi eksik.");
      return;
    }

    try {
      setStatus("loading");
      setError(null);

      const [nextConversation, nextMessages] = await Promise.all([
        fetchMobileConversationDetail(conversationId),
        fetchMobileConversationMessages(conversationId)
      ]);

      setConversation(nextConversation);
      setMessages(nextMessages);
      setStatus(nextMessages.length > 0 ? "ready" : "empty");
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "Konuşma yüklenemedi.");
    }
  }, [authSession.currentUser, conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  async function handleSend() {
    const body = draft.trim();

    if (!body || !conversationId || sending) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      const sentMessage = await sendMobileConversationMessage(conversationId, body);
      setMessages((currentMessages) => [...currentMessages, sentMessage]);
      setDraft("");
      setStatus("ready");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  if (!authSession.currentUser) {
    return (
      <Screen
        eyebrow="Mesajlar"
        title="Giriş gerekli"
        subtitle="Konuşma detayını görmek için hesabına giriş yap."
      >
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Mesajlar hesabına bağlıdır.</Text>
          <Text style={styles.stateText}>Satıcı ve alıcı konuşmaları yalnızca giriş yaptıktan sonra açılır.</Text>
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
      eyebrow="Konuşma"
      title={conversation?.title ?? "Mesajlaşma"}
      subtitle={conversation?.subtitle ?? "Satıcı ve alıcı mesajlarını güvenli şekilde takip et."}
    >
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Mesajlara dön</Text>
      </Pressable>

      {conversation?.listingTitle ? (
        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>İlan</Text>
          <Text style={styles.contextTitle}>{conversation.listingTitle}</Text>
          {conversation.otherProfileDisplayName ? (
            <Text style={styles.contextMeta}>{conversation.otherProfileDisplayName}</Text>
          ) : null}
        </View>
      ) : null}

      {status === "loading" ? <Paragraph>Konuşma yükleniyor...</Paragraph> : null}

      {status === "error" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Konuşma yüklenemedi</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable onPress={() => void loadConversation()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "empty" && messages.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Henüz mesaj yok</Text>
          <Text style={styles.stateText}>İlk mesajı yazarken telefon, e-posta veya açık adres paylaşma.</Text>
        </View>
      ) : null}

      <View style={styles.messageList}>
        {messages.map((message) => (
          <MessageBubble
            isOwn={Boolean(currentProfileId && message.senderProfileId === currentProfileId)}
            key={message.id}
            message={message}
          />
        ))}
      </View>

      <View style={styles.composerCard}>
        <TextInput
          multiline
          onChangeText={setDraft}
          placeholder="Mesajını yaz..."
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={draft}
        />

        <Pressable
          disabled={!canSend}
          onPress={handleSend}
          style={[styles.primaryButton, !canSend ? styles.disabledButton : null]}
        >
          <Text style={styles.primaryButtonText}>{sending ? "Gönderiliyor..." : "Gönder"}</Text>
        </Pressable>

        <Text style={styles.safetyNote}>
          Telefon, e-posta, açık adres veya ödeme bilgisi paylaşmadan BabyLoop içinde kal.
        </Text>

        {error && status !== "error" ? <Text style={styles.inlineError}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

function MessageBubble({
  message,
  isOwn
}: {
  message: MobileConversationMessage;
  isOwn: boolean;
}) {
  return (
    <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
      {!isOwn && message.senderDisplayName ? (
        <Text style={styles.senderLabel}>{message.senderDisplayName}</Text>
      ) : null}
      <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
        {message.body}
      </Text>
      {message.createdAt ? <Text style={styles.messageMeta}>{formatDate(message.createdAt)}</Text> : null}
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
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsedDate);
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900"
  },
  contextCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 4
  },
  contextLabel: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  contextTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  contextMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  messageList: {
    gap: 10
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: radius.lg,
    padding: 13,
    gap: 5
  },
  messageBubbleOwn: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary
  },
  messageBubbleOther: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  senderLabel: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "900"
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21
  },
  messageTextOwn: {
    color: "#ffffff"
  },
  messageTextOther: {
    color: colors.text
  },
  messageMeta: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "800"
  },
  composerCard: {
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10
  },
  input: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    padding: 13,
    textAlignVertical: "top"
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
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  safetyNote: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  inlineError: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
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
  }
});
