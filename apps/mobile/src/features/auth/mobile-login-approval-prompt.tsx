import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  approveMobileLoginApproval,
  denyMobileLoginApproval,
  fetchMobileLoginApprovals,
  type MobileLoginApprovalChallenge
} from "./auth-api";
import { requestMobileAuthSessionsRefresh } from "./auth-session-events";
import { useAuthSession } from "./auth-session";
import { subscribeMobileRealtime } from "../realtime/mobile-realtime";
import {
  buildMobileLoginApprovalPrompt,
  getCurrentMobileLoginApproval,
  mergeMobileLoginApprovalQueue,
  normalizeMobileLoginApprovalQueue,
  removeMobileLoginApprovalFromQueue
} from "../security/mobile-login-approval-model";
import { colors, radius, shadows, spacing } from "../../ui/theme";

export function MobileLoginApprovalPrompt() {
  const authSession = useAuthSession();
  const currentUser = authSession.currentUser;
  const [approvalQueue, setApprovalQueue] = useState<MobileLoginApprovalChallenge[]>([]);
  const [resolvingApprovalId, setResolvingApprovalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentApproval = useMemo(
    () => getCurrentMobileLoginApproval(approvalQueue),
    [approvalQueue]
  );
  const prompt = currentApproval ? buildMobileLoginApprovalPrompt(currentApproval) : null;

  useEffect(() => {
    if (!currentUser) {
      setApprovalQueue([]);
      setResolvingApprovalId(null);
      setError(null);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    async function loadPendingApprovals() {
      const response = await fetchMobileLoginApprovals();

      if (!active) {
        return;
      }

      if (response.ok) {
        setApprovalQueue(normalizeMobileLoginApprovalQueue(response.data.approvals));
        setError(null);
      } else {
        setApprovalQueue([]);
        setError("Giriş onayı istekleri şu an kontrol edilemedi.");
      }
    }

    void loadPendingApprovals();

    void subscribeMobileRealtime({
      onLoginApprovalCreated: (payload) => {
        setApprovalQueue((current) => mergeMobileLoginApprovalQueue(current, payload.approval));
        setError(null);
      }
    }).then((subscription) => {
      if (!active) {
        subscription.unsubscribe();
        return;
      }

      unsubscribe = subscription.unsubscribe;
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [currentUser]);

  async function handleResolve(action: "approve" | "deny") {
    if (!currentApproval) {
      return;
    }

    const approvalId = currentApproval.id;

    setResolvingApprovalId(approvalId);
    setError(null);

    try {
      const response = action === "approve"
        ? await approveMobileLoginApproval(approvalId)
        : await denyMobileLoginApproval(approvalId);

      if (!response.ok) {
        setError("İstek işlenemedi. Tekrar deneyebilirsin.");
        return;
      }

      setApprovalQueue((current) => removeMobileLoginApprovalFromQueue(current, response.data.approvalId));

      if (response.data.status === "approved") {
        requestMobileAuthSessionsRefresh();
      }
    } finally {
      setResolvingApprovalId(null);
    }
  }

  if (!currentUser || !prompt) {
    return null;
  }

  const resolving = resolvingApprovalId === prompt.id;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Mobil onay</Text>
          <Text style={styles.title}>{prompt.title}</Text>
          <Text style={styles.description}>{prompt.description}</Text>

          <View style={styles.deviceBox}>
            <Text style={styles.deviceLabel}>{prompt.deviceLabel}</Text>
            <Text style={styles.deviceMeta}>{prompt.deviceMeta}</Text>
            <Text style={styles.deviceMeta}>{prompt.createdAtLabel}</Text>
          </View>

          <Text style={styles.notice}>Bu istek kısa süre içinde geçerliliğini yitirebilir.</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              disabled={resolving}
              onPress={() => void handleResolve("deny")}
              style={({ pressed }) => [
                styles.denyButton,
                pressed || resolving ? styles.pressed : null
              ]}
            >
              <Text style={styles.denyButtonText}>{resolving ? "İşleniyor..." : prompt.denyLabel}</Text>
            </Pressable>
            <Pressable
              disabled={resolving}
              onPress={() => void handleResolve("approve")}
              style={({ pressed }) => [
                styles.approveButton,
                pressed || resolving ? styles.pressed : null
              ]}
            >
              <Text style={styles.approveButtonText}>{resolving ? "İşleniyor..." : prompt.approveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    maxWidth: 420,
    padding: 18,
    width: "100%"
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  deviceBox: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  deviceLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  deviceMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  notice: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: 11
  },
  errorText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  denyButton: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  denyButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900"
  },
  approveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flex: 1,
    paddingVertical: 13
  },
  approveButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.7
  }
});
