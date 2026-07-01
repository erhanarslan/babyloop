import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MobileButton, MobileCard, MobileEmptyState, MobileErrorState, MobileSectionHeader, MobileSkeleton } from "../../ui/mobile-primitives";
import { MobileListingCard, buildMobileListingChips } from "../../ui/mobile-listing-card";
import { Screen } from "../../ui/screen";
import { colors, spacing } from "../../ui/theme";
import { useAuthSession } from "../auth/auth-session";
import {
  checkoutMobileMockIyzico,
  clearMobileCart,
  fetchMobileCart,
  removeMobileCartItem,
  type MobileCart,
  type MobileCartItem,
  type MobileMockCheckout
} from "./basket-api";

export function BasketScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [cart, setCart] = useState<MobileCart | null>(null);
  const [checkout, setCheckout] = useState<MobileMockCheckout | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [actionStatus, setActionStatus] = useState<"idle" | "pending">("idle");
  const [error, setError] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    if (authSession.status !== "authenticated") {
      setCart(null);
      setStatus("ready");
      return;
    }

    try {
      setStatus("loading");
      setError(null);
      setCart(await fetchMobileCart());
      setStatus("ready");
    } catch (loadError) {
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Sepet yüklenemedi.");
    }
  }, [authSession.status]);

  useFocusEffect(
    useCallback(() => {
      void loadCart();
    }, [loadCart])
  );

  async function handleRemove(item: MobileCartItem) {
    try {
      setActionStatus("pending");
      setCart(await removeMobileCartItem(item.listingId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "İlan kaldırılamadı.");
    } finally {
      setActionStatus("idle");
    }
  }

  async function handleClear() {
    try {
      setActionStatus("pending");
      setCart(await clearMobileCart());
      setCheckout(null);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Sepet temizlenemedi.");
    } finally {
      setActionStatus("idle");
    }
  }

  async function handleCheckout() {
    try {
      setActionStatus("pending");
      setError(null);
      const nextCheckout = await checkoutMobileMockIyzico();
      setCheckout(nextCheckout);
      setCart(await fetchMobileCart());
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Mock iyzico ödeme tamamlanamadı.");
    } finally {
      setActionStatus("idle");
    }
  }

  return (
    <Screen
      eyebrow="Sepetim"
      title="Mock iyzico checkout"
      subtitle="Gerçek kart bilgisi alınmaz; demo ödeme başarılı olursa ilan satıldı durumuna geçer."
    >
      {authSession.status !== "authenticated" ? (
        <MobileEmptyState
          actionLabel="Giriş yap"
          message="Sepete eklediğin ilanlar ve demo checkout akışı hesabına bağlıdır."
          onAction={() => router.push("/login")}
          title="Sepet için giriş yap"
        />
      ) : null}

      {authSession.status === "authenticated" && status === "loading" ? <MobileSkeleton label="Sepet yükleniyor..." /> : null}

      {authSession.status === "authenticated" && status === "error" ? (
        <MobileErrorState
          actionLabel="Tekrar dene"
          message={error}
          onAction={() => void loadCart()}
          title="Sepet yüklenemedi"
        />
      ) : null}

      {authSession.status === "authenticated" && status === "ready" && cart && cart.items.length === 0 ? (
        <MobileEmptyState
          actionLabel="Keşfe dön"
          message="Aktif satılık ilanları sepete ekleyerek mock checkout akışını deneyebilirsin."
          onAction={() => router.push("/")}
          title="Sepetin boş"
        />
      ) : null}

      {authSession.status === "authenticated" && cart && cart.items.length > 0 ? (
        <>
          <MobileSectionHeader
            title="Sepetteki ilanlar"
            description="Checkout sırasında ilan durumu tekrar kontrol edilir."
          />
          <View style={styles.list}>
            {cart.items.map((item) => (
              <CartItemCard
                disabled={actionStatus === "pending"}
                item={item}
                key={item.id}
                onOpen={() => router.push(`/listing/${encodeURIComponent(item.listingId)}`)}
                onRemove={() => void handleRemove(item)}
              />
            ))}
          </View>

          <MobileCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ara toplam</Text>
              <Text style={styles.summaryValue}>{cart.subtotalText}</Text>
            </View>
            <Text style={styles.summaryHint}>Bağış/takas ilanları sepetlenebilir ama mock ödeme sadece satılık ilanlar içindir.</Text>
            <MobileButton
              disabled={actionStatus === "pending"}
              iconName="card-outline"
              onPress={() => void handleCheckout()}
            >
              {actionStatus === "pending" ? "İşleniyor..." : "Mock iyzico ile öde"}
            </MobileButton>
            <MobileButton
              disabled={actionStatus === "pending"}
              iconName="trash-outline"
              onPress={() => void handleClear()}
              variant="secondary"
            >
              Sepeti temizle
            </MobileButton>
          </MobileCard>
        </>
      ) : null}

      {checkout ? (
        <MobileCard style={styles.successCard}>
          <Text style={styles.successTitle}>Mock ödeme başarılı</Text>
          <Text style={styles.successText}>Order ID: {checkout.orderId}</Text>
          <Text style={styles.successText}>Payment ID: {checkout.paymentId}</Text>
          <Text style={styles.successText}>Tutar: {checkout.paidAmountText}</Text>
        </MobileCard>
      ) : null}

      {error && status !== "error" ? <Text style={styles.inlineError}>{error}</Text> : null}
    </Screen>
  );
}

function CartItemCard({
  disabled,
  item,
  onOpen,
  onRemove
}: {
  disabled: boolean;
  item: MobileCartItem;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <MobileListingCard
      accessibilityLabel={`Sepet ilanını aç: ${item.title}`}
      actions={
        <>
          <MobileButton
            disabled={disabled}
            iconName="open-outline"
            onPress={onOpen}
            variant="secondary"
          >
            Detay
          </MobileButton>
          <MobileButton
            disabled={disabled}
            iconName="trash-outline"
            onPress={onRemove}
            variant="secondary"
          >
            Kaldır
          </MobileButton>
        </>
      }
      chips={buildMobileListingChips({
        conditionText: item.conditionText,
        listingTypeText: item.listingTypeText,
        statusText: item.statusText
      })}
      imageUrl={item.imageUrl}
      locationText="Sepet"
      priceText={item.priceText}
      title={item.title}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md
  },
  summaryCard: {
    gap: spacing.md
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  summaryHint: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  successCard: {
    gap: spacing.xs,
    borderColor: colors.success
  },
  successTitle: {
    color: colors.success,
    fontSize: 17,
    fontWeight: "900"
  },
  successText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  inlineError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800"
  }
});
