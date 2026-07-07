import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { MobileButton, MobileCard, MobileErrorState } from "../../ui/mobile-primitives";
import { Screen } from "../../ui/screen";
import { colors, radius, spacing } from "../../ui/theme";
import { askMobileAssistant, type MobileAssistantAnswer } from "./assistant-api";


export function AssistantEntryScreen() {
  const [inputValue, setInputValue] = useState("");
  const [answer, setAnswer] = useState<MobileAssistantAnswer | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(nextMessage = inputValue) {
    const message = nextMessage.trim();

    if (!message || status === "pending") {
      return;
    }

    try {
      setInputValue(message);
      setStatus("pending");
      setError(null);
      setAnswer(await askMobileAssistant(message));
      setStatus("idle");
    } catch (askError) {
      setStatus("error");
      setError(askError instanceof Error ? askError.message : "Asistan yanıtı alınamadı.");
    }
  }

  return (
    <Screen
      eyebrow="Asistan"
      title="BabyLoop Asistan"
      subtitle="Sorunu kısa yaz, güvenli sınırlar içinde yanıt al."
    >

      <MobileCard style={styles.composerCard}>
        <Text style={styles.inputLabel}>Sorunu yaz</Text>
        <TextInput
          accessibilityLabel="Asistana soru yaz"
          multiline
          maxLength={200}
          onChangeText={setInputValue}
          placeholder="Örn. Oto koltuğu ikinci el alınır mı?"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          textAlignVertical="top"
          value={inputValue}
        />
        <View style={styles.composerFooter}>
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

      {status === "error" ? (
        <MobileErrorState
          message={error}
          title="Asistan yanıtı alınamadı"
        />
      ) : null}

      {answer ? (
        <MobileCard accessible accessibilityLabel="Asistan cevabı" style={styles.answerCard}>
          <Text style={styles.answerTitle}>Yanıt</Text>
          <Text style={styles.answerText}>{answer.answer}</Text>
          <Text style={styles.answerMode}>
            Mod: {answer.mode === "boundary" ? "Güvenli sınır" : answer.grounded ? "Kaynaklı" : "Genel"}
          </Text>
          {answer.sources.length > 0 ? (
            <View style={styles.sources}>
              <Text style={styles.sourcesTitle}>Kaynaklar</Text>
              {answer.sources.slice(0, 3).map((source) => (
                <Text key={`${source.sourcePath ?? source.title}-${source.section ?? ""}`} style={styles.sourceItem}>
                  {source.title}{source.section ? ` · ${source.section}` : ""}
                </Text>
              ))}
            </View>
          ) : null}
        </MobileCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: "flex-end",
    gap: spacing.md
  },
  answerCard: {
    gap: spacing.sm
  },
  answerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  answerText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  },
  answerMode: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
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
  }
});
