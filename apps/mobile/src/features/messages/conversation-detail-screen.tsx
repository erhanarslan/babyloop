import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { useAndroidNavigationBarVisibility } from "../../lib/android-navigation-bar";
import { getAndroidAwareBottomOffset } from "../../ui/mobile-layout";
import { colors, radius, shadows, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  fetchMobileConversationDetail,
  fetchMobileConversationMessages,
  sendMobileConversationMessage,
  type MobileConversationDetail,
  type MobileConversationMessage
} from "./messages-api";

export function ConversationDetailScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const androidNavigationVisibility = useAndroidNavigationBarVisibility() ?? "hidden";
  const authSession = useAuthSession();
  const currentProfileId = authSession.currentUser?.profile.id ?? null;
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const scrollViewRef = useRef<ScrollView>(null);

  const [conversation, setConversation] = useState<MobileConversationDetail | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const composerBottomInset = getAndroidAwareBottomOffset({
    androidNavigationVisibility,
    platformOS: Platform.OS,
    safeAreaBottom: insets.bottom
  });

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const loadConversation = useCallback(async () => {
    if (!authSession.currentUser || !conversationId) {
      setConversation(null);
      setMessages([]);
      setStatus("ready");
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
      setStatus("ready");
    } catch (loadError) {
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Konuşma yüklenemedi.");
    }
  }, [authSession.currentUser, conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      scrollToBottom(true);
    });

    return () => {
      showSubscription.remove();
    };
  }, [scrollToBottom]);

  async function handleSend() {
    const nextBody = body.trim();

    if (!nextBody || sending || !conversationId) {
      return;
    }

    try {
      setSending(true);
      setError(null);

      const sentMessage = await sendMobileConversationMessage(conversationId, nextBody);

      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === sentMessage.id)) {
          return currentMessages;
        }

        return [...currentMessages, sentMessage];
      });
      setBody("");
      scrollToBottom(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  function handleBack() {
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      style={styles.keyboardRoot}
    >
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Mesajlar</Text>
          </Pressable>

          <View style={styles.headerTitleBlock}>
            <Text numberOfLines={1} style={styles.title}>
              {conversation?.otherProfileDisplayName ?? conversation?.title ?? "Konuşma"}
            </Text>

            {conversation?.listingTitle ? (
              <Pressable onPress={handleOpenListing} style={styles.listingPill}>
                <Text numberOfLines={1} style={styles.listingPillText}>
                  {conversation.listingTitle}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {status === "loading" ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Konuşma yükleniyor...</Text>
          </View>
        ) : null}

        {status === "error" ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Konuşma yüklenemedi</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable onPress={() => void loadConversation()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => scrollToBottom(false)}
          onLayout={() => scrollToBottom(false)}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.messagesScroll}
        >
          {messages.length === 0 && status === "ready" ? (
            <View style={styles.emptyState}>
              <Text style={styles.stateTitle}>Henüz mesaj yok</Text>
              <Text style={styles.stateText}>İlanla ilgili ilk sorunu yazabilirsin.</Text>
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
                  <Text style={[styles.messageMeta, own ? styles.messageMetaOwn : null]}>
                    {formatDate(message.createdAt)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(composerBottomInset, 12) }]}>
          {error && status === "ready" ? <Text style={styles.inlineError}>{error}</Text> : null}

          <View style={styles.composerRow}>
            <TextInput
              maxLength={5000}
              multiline
              onChangeText={setBody}
              placeholder="Durum, teslim veya ek fotoğraf sor..."
              placeholderTextColor={colors.subtle}
              style={styles.input}
              textAlignVertical="top"
              value={body}
            />
            <Pressable
              disabled={sending || body.trim().length === 0}
              onPress={() => void handleSend()}
              style={[
                styles.sendButton,
                sending || body.trim().length === 0 ? styles.sendButtonDisabled : null
              ]}
            >
              <Text style={styles.sendButtonText}>{sending ? "..." : "Gönder"}</Text>
            </Pressable>
          </View>

          <Text style={styles.counter}>{body.length}/5000</Text>
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

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
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
    ...shadows.card,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  backButton: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 5
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2
  },
  listingPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  listingPillText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  messagesScroll: {
    flex: 1
  },
  messageList: {
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: "flex-end",
    padding: 14,
    paddingBottom: 24
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  messageBubbleOwn: {
    alignSelf: "flex-end",
    borderBottomRightRadius: radius.sm,
    backgroundColor: colors.primary
  },
  messageBubbleOther: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
    backgroundColor: colors.surface
  },
  senderName: {
    marginBottom: 4,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900"
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21
  },
  messageTextOwn: {
    color: colors.primaryForeground
  },
  messageTextOther: {
    color: colors.text
  },
  messageMeta: {
    marginTop: 5,
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "800"
  },
  messageMetaOwn: {
    color: "rgba(255,255,255,0.78)"
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingTop: 10
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  sendButton: {
    minHeight: 46,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 14
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: "900"
  },
  counter: {
    alignSelf: "flex-end",
    marginTop: 5,
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "800"
  },
  inlineError: {
    marginBottom: spacing.xs,
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    padding: 20
  },
  stateCard: {
    margin: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
    gap: spacing.sm
  },
  emptyState: {
    alignSelf: "center",
    maxWidth: 260,
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    padding: 16
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  }
});
