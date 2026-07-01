import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadows } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileConversationDetail,
  fetchMobileConversationMessages,
  sendMobileConversationMessage,
  type MobileConversationDetail,
  type MobileConversationMessage
} from "./messages-api";

const CONVERSATION_POLL_INTERVAL_MS = 2500;

export function ConversationDetailScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const currentProfileId = authSession.currentUser?.profile.id ?? null;
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const scrollViewRef = useRef<ScrollView>(null);

  const [conversation, setConversation] = useState<MobileConversationDetail | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const loadConversation = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!authSession.currentUser || !conversationId) {
        setConversation(null);
        setMessages([]);
        setStatus("ready");
        return;
      }

      try {
        if (!options.silent) {
          setStatus("loading");
        }

        const [nextConversation, nextMessages] = await Promise.all([
          fetchMobileConversationDetail(conversationId),
          fetchMobileConversationMessages(conversationId)
        ]);

        setConversation(nextConversation);
        setMessages(nextMessages);
        setStatus("ready");
        setError(null);
      } catch (loadError) {
        if (!options.silent) {
          setStatus("error");
          setError(loadError instanceof Error ? loadError.message : "Konuşma yüklenemedi.");
        }
      }
    },
    [authSession.currentUser, conversationId]
  );

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!authSession.currentUser || !conversationId) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadConversation({ silent: true });
    }, CONVERSATION_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [authSession.currentUser, conversationId, loadConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(scrollToBottom, 80);
      setTimeout(scrollToBottom, 220);
    });

    return () => {
      showSubscription.remove();
    };
  }, [scrollToBottom]);

  async function handleSend() {
    const body = draft.trim();

    if (!body || sending || !conversationId) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      const sentMessage = await sendMobileConversationMessage(conversationId, body);

      setDraft("");
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === sentMessage.id)) {
          return currentMessages;
        }

        return [...currentMessages, sentMessage];
      });

      await loadConversation({ silent: true });
      scrollToBottom();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  function handleBackToMessages() {
    router.replace("/messages");
  }

  function handleOpenListing() {
    if (!conversation?.listingId) {
      return;
    }

    router.push(`/listing/${encodeURIComponent(conversation.listingId)}`);
  }

  if (!authSession.currentUser) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Mesajları görmek için giriş yap</Text>
          <Text style={styles.stateText}>Konuşmalar hesabına bağlıdır.</Text>
          <Pressable onPress={() => router.push("/login")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Giriş yap</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      style={styles.keyboardRoot}
    >
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleBackToMessages} style={styles.backButton}>
            <Text style={styles.backButtonText}>Mesajlara dön</Text>
          </Pressable>

          <View style={styles.headerTextBlock}>
            <Text numberOfLines={1} style={styles.title}>
              {conversation?.otherProfileDisplayName ?? conversation?.title ?? "Konuşma"}
            </Text>
            {conversation?.listingTitle ? (
              <Pressable onPress={handleOpenListing}>
                <Text numberOfLines={1} style={styles.listingLink}>
                  {conversation.listingTitle}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.subtitle}>BabyLoop mesajlaşma</Text>
            )}
          </View>
        </View>

        {status === "loading" ? (
          <View style={styles.inlineState}>
            <Text style={styles.stateText}>Konuşma yükleniyor...</Text>
          </View>
        ) : null}

        {status === "error" ? (
          <View style={styles.inlineState}>
            <Text style={styles.stateTitle}>Konuşma yüklenemedi</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={() => void loadConversation()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.messageList}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
          onScrollBeginDrag={Keyboard.dismiss}
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.messagesScroll}
        >
          {messages.length === 0 && status === "ready" ? (
            <View style={styles.emptyMessages}>
              <Text style={styles.stateTitle}>Henüz mesaj yok</Text>
              <Text style={styles.stateText}>İlanla ilgili ilk sorunu buradan yazabilirsin.</Text>
            </View>
          ) : null}

          {messages.map((message) => {
            const own = message.senderProfileId === currentProfileId;

            return (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  own ? styles.messageBubbleOwn : styles.messageBubbleOther
                ]}
              >
                {!own && message.senderDisplayName ? (
                  <Text style={styles.senderName}>{message.senderDisplayName}</Text>
                ) : null}
                <Text style={[styles.messageText, own ? styles.messageTextOwn : styles.messageTextOther]}>
                  {message.body}
                </Text>
                {message.createdAt ? (
                  <Text style={styles.messageMeta}>{formatDate(message.createdAt)}</Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {error && status !== "error" ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.composerRow}>
            <TextInput
              multiline
              onChangeText={setDraft}
              onFocus={scrollToBottom}
              placeholder="Mesaj yaz..."
              placeholderTextColor={colors.subtle}
              style={styles.input}
              textAlignVertical="top"
              value={draft}
            />
            <Pressable
              disabled={!canSend}
              onPress={handleSend}
              style={[styles.sendButton, !canSend ? styles.sendButtonDisabled : null]}
            >
              <Text style={styles.sendButtonText}>{sending ? "..." : "Gönder"}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  backButton: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  headerTextBlock: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  listingLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  messagesScroll: {
    flex: 1
  },
  messageList: {
    flexGrow: 1,
    gap: 10,
    justifyContent: "flex-end",
    padding: 14,
    paddingBottom: 24
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 4
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
  senderName: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20
  },
  messageTextOwn: {
    color: colors.primaryForeground
  },
  messageTextOther: {
    color: colors.text
  },
  messageMeta: {
    alignSelf: "flex-end",
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "700"
  },
  composer: {
    ...shadows.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingTop: 10
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
  },
  input: {
    flex: 1,
    maxHeight: 118,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  sendButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 15
  },
  sendButtonDisabled: {
    opacity: 0.45
  },
  sendButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: "900"
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    gap: 12
  },
  inlineState: {
    margin: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8
  },
  emptyMessages: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 6
  },
  stateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: colors.primaryForeground,
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
