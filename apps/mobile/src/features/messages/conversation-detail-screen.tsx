import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, shadows, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import { MOBILE_TAB_BAR_HEIGHT } from "../../ui/mobile-layout";
import {
  MOBILE_REALTIME_EVENTS,
  subscribeMobileRealtime
} from "../realtime/mobile-realtime";
import {
  fetchMobileConversationDetail,
  fetchMobileConversationMessages,
  sendMobileConversationMessage,
  type MobileConversationDetail,
  type MobileConversationMessage
} from "./messages-api";
import {
  appendRealtimeMessage,
  mergeRealtimeConversationDetail
} from "./messages-realtime-model";
import {
  canSendMobileConversationMessage,
  getMobileConversationListingContext,
  getMobileConversationMessageCharacterCount
} from "./conversation-detail-model";

const COMPOSER_KEYBOARD_GAP = 52;
const COMPOSER_TAB_GAP = 8;
const COMPOSER_RESERVED_HEIGHT = 86;
const KEYBOARD_OFFSET_JUMP_TOLERANCE = 16;
const KEYBOARD_STABLE_OFFSET_DELAY_MS = 220;

export function ConversationDetailScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const router = useRouter();
  const authSession = useAuthSession();
  const currentProfileId = authSession.currentUser?.profile.id ?? null;
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const scrollViewRef = useRef<ScrollView>(null);
  const hideResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardHeightRef = useRef(0);
  const keyboardSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootLayoutHeightRef = useRef(0);
  const stableAndroidKeyboardBottomOffsetRef = useRef<number | null>(null);

  const [conversation, setConversation] = useState<MobileConversationDetail | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [rootLayoutHeight, setRootLayoutHeight] = useState(0);
  const [sending, setSending] = useState(false);
  const keyboardVisible = keyboardHeight > 0;
  const viewportKeyboardOverlap =
    Platform.OS === "android" && keyboardVisible
      ? Math.max(0, rootLayoutHeightRef.current - rootLayoutHeight)
      : 0;
  const rawAndroidKeyboardBottomOffset = Math.max(0, keyboardHeight - viewportKeyboardOverlap);
  const stableAndroidKeyboardBottomOffset = stableAndroidKeyboardBottomOffsetRef.current;
  const androidKeyboardBottomOffset =
    Platform.OS === "android" &&
    keyboardVisible &&
    stableAndroidKeyboardBottomOffset !== null &&
    rawAndroidKeyboardBottomOffset > stableAndroidKeyboardBottomOffset + KEYBOARD_OFFSET_JUMP_TOLERANCE
      ? stableAndroidKeyboardBottomOffset
      : rawAndroidKeyboardBottomOffset;
  const composerBottomOffset = keyboardVisible
    ? Platform.OS === "android"
      ? androidKeyboardBottomOffset + COMPOSER_KEYBOARD_GAP
      : COMPOSER_KEYBOARD_GAP
    : MOBILE_TAB_BAR_HEIGHT + COMPOSER_TAB_GAP;
  const messageListBottomPadding = composerBottomOffset + COMPOSER_RESERVED_HEIGHT;
  const listingContext = getMobileConversationListingContext(conversation);
  const messageCharacterCount = getMobileConversationMessageCharacterCount(body);
  const canSendMessage = canSendMobileConversationMessage({
    body,
    conversationId,
    sending
  });

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const clearKeyboardTimers = useCallback(() => {
    if (hideResetTimeoutRef.current) {
      clearTimeout(hideResetTimeoutRef.current);
      hideResetTimeoutRef.current = null;
    }

    if (keyboardSettleTimeoutRef.current) {
      clearTimeout(keyboardSettleTimeoutRef.current);
      keyboardSettleTimeoutRef.current = null;
    }
  }, []);

  const isKeyboardCurrentlyVisible = useCallback(() => {
    const keyboardApi = Keyboard as typeof Keyboard & {
      isVisible?: () => boolean;
    };

    return typeof keyboardApi.isVisible === "function" ? keyboardApi.isVisible() : false;
  }, []);

  const setMeasuredKeyboardHeight = useCallback((nextHeight: number) => {
    const normalizedHeight = Math.max(0, nextHeight);

    keyboardHeightRef.current = normalizedHeight;
    setKeyboardHeight(normalizedHeight);
  }, []);

  const handleKeyboardShow = useCallback((event: KeyboardEvent) => {
    clearKeyboardTimers();
    setMeasuredKeyboardHeight(event.endCoordinates?.height ?? 0);
    scrollToBottom();

    keyboardSettleTimeoutRef.current = setTimeout(() => {
      if (!isKeyboardCurrentlyVisible()) {
        keyboardSettleTimeoutRef.current = null;
        return;
      }

      setMeasuredKeyboardHeight(event.endCoordinates?.height ?? 0);
      scrollToBottom(false);
      keyboardSettleTimeoutRef.current = null;
    }, 80);
  }, [clearKeyboardTimers, isKeyboardCurrentlyVisible, scrollToBottom, setMeasuredKeyboardHeight]);

  const handleKeyboardHide = useCallback(() => {
    if (hideResetTimeoutRef.current) {
      clearTimeout(hideResetTimeoutRef.current);
    }

    hideResetTimeoutRef.current = setTimeout(() => {
      if (isKeyboardCurrentlyVisible()) {
        hideResetTimeoutRef.current = null;
        return;
      }

      setMeasuredKeyboardHeight(0);
      scrollToBottom(false);
      hideResetTimeoutRef.current = null;
    }, 80);
  }, [isKeyboardCurrentlyVisible, scrollToBottom, setMeasuredKeyboardHeight]);

  const handleInputFocus = useCallback(() => {
    if (Platform.OS !== "android" || isKeyboardCurrentlyVisible()) {
      return;
    }

    if (keyboardHeightRef.current > 0) {
      setMeasuredKeyboardHeight(0);
    }
  }, [isKeyboardCurrentlyVisible, setMeasuredKeyboardHeight]);

  const handleInputBlur = useCallback(() => {
    if (Platform.OS !== "android" || isKeyboardCurrentlyVisible()) {
      return;
    }

    setMeasuredKeyboardHeight(0);
  }, [isKeyboardCurrentlyVisible, setMeasuredKeyboardHeight]);

  const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    if (nextHeight <= 0) {
      return;
    }

    setRootLayoutHeight(nextHeight);

    if (keyboardHeightRef.current === 0) {
      rootLayoutHeightRef.current = nextHeight;
      return;
    }

    rootLayoutHeightRef.current = Math.max(rootLayoutHeightRef.current, nextHeight);
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
    const showSubscription = Keyboard.addListener("keyboardDidShow", handleKeyboardShow);
    const hideSubscription = Keyboard.addListener("keyboardDidHide", handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearKeyboardTimers();
    };
  }, [clearKeyboardTimers, handleKeyboardHide, handleKeyboardShow]);

  useEffect(() => {
    if (Platform.OS !== "android" || !keyboardVisible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      stableAndroidKeyboardBottomOffsetRef.current = rawAndroidKeyboardBottomOffset;
    }, KEYBOARD_STABLE_OFFSET_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [keyboardVisible, rawAndroidKeyboardBottomOffset]);

  useEffect(() => {
    if (!authSession.currentUser || !conversationId) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | null = null;

    void subscribeMobileRealtime({
      onConversationUpdated: (payload) => {
        if (payload.conversationId !== conversationId) {
          return;
        }

        setConversation((currentConversation) =>
          mergeRealtimeConversationDetail(currentConversation, payload.conversation)
        );
      },
      onMessageCreated: (payload) => {
        if (payload.conversationId !== conversationId) {
          return;
        }

        setMessages((currentMessages) => appendRealtimeMessage(currentMessages, payload, conversationId));
        scrollToBottom(true);
      }
    }).then((subscription) => {
      if (!active) {
        subscription.unsubscribe();
        return;
      }

      if (subscription.socket) {
        subscription.socket.emit(MOBILE_REALTIME_EVENTS.conversationJoin, {
          conversationId
        });
      }

      cleanup = () => {
        if (subscription.socket) {
          subscription.socket.emit(MOBILE_REALTIME_EVENTS.conversationLeave, {
            conversationId
          });
        }

        subscription.unsubscribe();
      };
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [authSession.currentUser, conversationId, scrollToBottom]);

  async function handleSend() {
    const nextBody = body.trim();

    if (!canSendMobileConversationMessage({ body: nextBody, conversationId, sending })) {
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

  const screenContent = (
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

        {listingContext ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleOpenListing}
            style={[
              styles.listingContextCard,
              listingContext.tone === "warning" ? styles.listingContextCardWarning : null
            ]}
          >
            <View style={styles.listingContextHeader}>
              <Text style={styles.listingContextEyebrow}>İlan bağlamı</Text>
              {listingContext.statusText ? (
                <Text
                  style={[
                    styles.listingContextStatus,
                    listingContext.tone === "warning" ? styles.listingContextStatusWarning : null
                  ]}
                >
                  {listingContext.statusText}
                </Text>
              ) : null}
            </View>

            <Text numberOfLines={1} style={styles.listingContextTitle}>
              {listingContext.title}
            </Text>
            <Text style={styles.listingContextSubtitle}>{listingContext.subtitle}</Text>
            <Text style={styles.listingContextAction}>{listingContext.actionLabel} →</Text>
          </Pressable>
        ) : null}

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
          contentContainerStyle={[styles.messageList, { paddingBottom: messageListBottomPadding }]}
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

        <View style={[styles.composer, { bottom: composerBottomOffset }]}>
          {error && status === "ready" ? <Text style={styles.inlineError}>{error}</Text> : null}

          <View style={styles.composerMetaRow}>
            <Text style={[
              styles.characterCount,
              messageCharacterCount.isOverLimit ? styles.characterCountDanger : null
            ]}>
              {messageCharacterCount.remaining} karakter
            </Text>
          </View>

          <View style={styles.composerRow}>
            <TextInput
              maxLength={500}
              multiline
              onBlur={handleInputBlur}
              onChangeText={setBody}
              onFocus={handleInputFocus}
              placeholder="Durum, teslim veya ek fotoğraf sor..."
              placeholderTextColor={colors.subtle}
              style={styles.input}
              textAlignVertical="center"
              value={body}
            />
            <Pressable
              disabled={!canSendMessage}
              onPress={() => void handleSend()}
              style={[
                styles.sendButton,
                !canSendMessage ? styles.sendButtonDisabled : null
              ]}
            >
              <Text style={styles.sendButtonText}>{sending ? "..." : "Gönder"}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
  );

  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={8}
        style={styles.keyboardRoot}
      >
        {screenContent}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View onLayout={handleRootLayout} style={styles.keyboardRoot}>
      {screenContent}
    </View>
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
    position: "relative",
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
  listingContextCard: {
    marginHorizontal: 14,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs
  },
  listingContextCardWarning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft
  },
  listingContextHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  listingContextEyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  listingContextStatus: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.successSoft,
    color: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "900"
  },
  listingContextStatusWarning: {
    backgroundColor: colors.warningSoft,
    color: colors.warning
  },
  listingContextTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  listingContextSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  listingContextAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
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
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadows.card
  },
  composerMetaRow: {
    alignItems: "flex-end"
  },
  characterCount: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "800"
  },
  characterCountDanger: {
    color: colors.danger
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === "android" ? 8 : 11
  },
  sendButton: {
    minHeight: 46,
    alignItems: "center",
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
