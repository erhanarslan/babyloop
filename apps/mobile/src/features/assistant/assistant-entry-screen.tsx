import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { MobileButton, MobileCard, MobileErrorState } from "../../ui/mobile-primitives";
import { Screen } from "../../ui/screen";
import { colors, radius, spacing } from "../../ui/theme";
import { askMobileAssistant, type MobileAssistantAnswer } from "./assistant-api";
import { buildMobileAssistantAnswerDisplay } from "./assistant-display-model";

type AssistantMessage =
  | {
      id: string;
      role: "user";
      text: string;
    }
  | {
      answer: MobileAssistantAnswer;
      id: string;
      role: "assistant";
    };

const QUICK_QUESTIONS = [
  "Bebek arabası alırken nelere dikkat etmeliyim?",
  "İkinci el oto koltuğu için hangi soruları sormalıyım?",
  "12-24 ay için hangi ürünlere ihtiyaç olabilir?"
];

const MAX_ASSISTANT_INPUT_LENGTH = 1000;

export function AssistantEntryScreen() {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(nextMessage = inputValue) {
    const message = nextMessage.trim();

    if (!message || status === "pending") {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("pending");
    setPendingPrompt(message);
    setError(null);
    setInputValue("");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${requestId}`,
        role: "user",
        text: message
      }
    ]);

    try {
      const answer = await askMobileAssistant(message);

      if (requestIdRef.current !== requestId) {
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          answer,
          id: `assistant-${requestId}`,
          role: "assistant"
        }
      ]);
      setStatus("idle");
      setPendingPrompt(null);
    } catch (askError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setStatus("error");
      setError(askError instanceof Error ? askError.message : "Asistan yanıtı alınamadı.");
    }
  }

  function handleRetry() {
    if (!pendingPrompt) {
      return;
    }

    void handleAsk(pendingPrompt);
  }

  function handleActionHref(href: string | undefined) {
    if (!href) {
      return;
    }

    router.push(href as never);
  }

  return (
    <Screen
      eyebrow="Asistan"
      title="BabyLoop Asistan"
      subtitle="Güvenli alışveriş, ürün seçimi ve BabyLoop kullanımı için sor."
    >
      <MobileCard style={styles.quickCard}>
        <Text style={styles.sectionTitle}>Hızlı sorular</Text>
        <View style={styles.quickQuestionList}>
          {QUICK_QUESTIONS.map((question) => (
            <Pressable
              accessibilityRole="button"
              disabled={status === "pending"}
              key={question}
              onPress={() => void handleAsk(question)}
              style={[styles.quickQuestionButton, status === "pending" ? styles.disabled : null]}
            >
              <Text style={styles.quickQuestionText}>{question}</Text>
            </Pressable>
          ))}
        </View>
      </MobileCard>

      <ScrollView
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <MobileCard style={styles.emptyCard}>
            <Text style={styles.answerText}>
              Soruların bu ekranda geçici olarak görünür; hassas sohbet geçmişi cihazda kalıcı saklanmaz.
            </Text>
          </MobileCard>
        ) : null}

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <View key={message.id} style={styles.userBubble}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
            );
          }

          return (
            <AssistantAnswerCard
              answer={message.answer}
              key={message.id}
              onOpenHref={handleActionHref}
            />
          );
        })}

        {status === "pending" ? (
          <MobileCard style={styles.answerCard}>
            <Text style={styles.answerTitle}>Yanıt hazırlanıyor...</Text>
            <Text style={styles.answerText}>Kaynaklar ve güvenli sınırlar kontrol ediliyor.</Text>
          </MobileCard>
        ) : null}
      </ScrollView>

      {status === "error" ? (
        <MobileErrorState
          message={error}
          title="Asistan yanıtı alınamadı"
        />
      ) : null}

      {status === "error" && pendingPrompt ? (
        <MobileButton accessibilityLabel="Son soruyu tekrar dene" onPress={handleRetry}>
          Tekrar dene
        </MobileButton>
      ) : null}

      <MobileCard style={styles.composerCard}>
        <Text style={styles.inputLabel}>Sorunu yaz</Text>
        <TextInput
          accessibilityLabel="Asistana soru yaz"
          multiline
          maxLength={MAX_ASSISTANT_INPUT_LENGTH}
          onChangeText={setInputValue}
          placeholder="Örn. Oto koltuğu ikinci el alınır mı?"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          textAlignVertical="top"
          value={inputValue}
        />
        <View style={styles.composerFooter}>
          <Text style={styles.counterText}>
            {inputValue.length}/{MAX_ASSISTANT_INPUT_LENGTH}
          </Text>
          <MobileButton
            accessibilityLabel="Asistana gönder"
            disabled={status === "pending" || inputValue.trim().length === 0}
            iconName="sparkles-outline"
            onPress={() => void handleAsk()}
          >
            {status === "pending" ? "Yanıt hazırlanıyor..." : "Sor"}
          </MobileButton>
        </View>
      </MobileCard>
    </Screen>
  );
}

function AssistantAnswerCard({
  answer,
  onOpenHref
}: {
  answer: MobileAssistantAnswer;
  onOpenHref: (href: string | undefined) => void;
}) {
  const display = buildMobileAssistantAnswerDisplay(answer);

  return (
    <MobileCard accessible accessibilityLabel="Asistan cevabı" style={styles.answerCard}>
      <View style={styles.badgeRow}>
        <Text style={styles.modeBadge}>{display.modeLabel}</Text>
        {display.showGrounded ? <Text style={styles.groundedBadge}>{display.groundedLabel}</Text> : null}
      </View>

      <Text style={styles.answerText}>{answer.answer}</Text>

      {display.sourceCards.length > 0 ? (
        <View style={styles.sources}>
          <Text style={styles.sourcesTitle}>Kaynaklar</Text>
          {display.sourceCards.map((source) => (
            <Text key={source.id} style={styles.sourceItem}>
              {source.label}{source.reliability ? ` · ${source.reliability}` : ""}
            </Text>
          ))}
        </View>
      ) : null}

      {display.toolPreviewCards.length > 0 ? (
        <View style={styles.sources}>
          <Text style={styles.sourcesTitle}>Araç sonuçları</Text>
          {display.toolPreviewCards.map((preview) => (
            <Text key={preview.id} style={styles.sourceItem}>
              {preview.title}: {preview.summary}
            </Text>
          ))}
        </View>
      ) : null}

      {display.actionCards.length > 0 ? (
        <View style={styles.actionList}>
          {display.actionCards.map((action) => (
            <Pressable
              accessibilityRole="button"
              disabled={!action.href}
              key={action.id}
              onPress={() => onOpenHref(action.href)}
              style={[styles.actionButton, !action.href ? styles.disabled : null]}
            >
              <Text style={styles.actionButtonText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </MobileCard>
  );
}

const styles = StyleSheet.create({
  quickCard: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  quickQuestionList: {
    gap: spacing.xs
  },
  quickQuestionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickQuestionText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  messageList: {
    gap: spacing.md
  },
  emptyCard: {
    gap: spacing.xs
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "86%",
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  userText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
  },
  composerCard: {
    gap: spacing.md
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  input: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    padding: spacing.md
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  counterText: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "800"
  },
  answerCard: {
    gap: spacing.sm
  },
  answerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  answerText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  modeBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  groundedBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.successSoft,
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  sources: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  sourcesTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  sourceItem: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  actionList: {
    gap: spacing.xs
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 10
  },
  actionButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.55
  }
});
