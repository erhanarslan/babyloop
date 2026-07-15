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
import {
  canCheckoutMobileCart,
  getMobileBasketCheckoutState,
  getMobileBasketCheckoutSuccessCopy,
  getMobileBasketDemoPaymentCopy,
  getMobileBasketUnavailableItemsCopy
} from "./basket-model";

export function BasketScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [cart, setCart] = useState<MobileCart | null>(null);
  const [checkout, setCheckout] = useState<MobileMockCheckout | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [actionStatus, setActionStatus] = useState<"idle" | "pending">("idle");
  const [error, setError] = useState<string | null>(null);
  const checkoutState = getMobileBasketCheckoutState(cart, actionStatus);
  const checkoutSuccessCopy = checkout ? getMobileBasketCheckoutSuccessCopy(checkout) : null;

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
    if (!canCheckoutMobileCart(cart)) {
      setError(checkoutState.reason ?? "Checkout için sepeti kontrol et.");
      return;
    }

    try {
      setActionStatus("pending");
      setError(null);
      const nextCheckout = await checkoutMobileMockIyzico();
      setCheckout(nextCheckout);
      setCart(await fetchMobileCart());
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Demo checkout tamamlanamadı. Sepet değişmedi.");
    } finally {
      setActionStatus("idle");
    }
  }

  return (
    <Screen title="Sepet">
      {authSession.status !== "authenticated" ? (
        <MobileEmptyState
          actionLabel="Giriş yap"
          message="Sepet hesabına bağlıdır."
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

      {authSession.status === "authenticated" && status === "ready" && cart && cart.items.length === 0 && cart.unavailableItems.length === 0 ? (
        <MobileEmptyState
          actionLabel="Keşfe dön"
          message="Satılık aktif bir ilanı sepete ekleyerek demo checkout akışını deneyebilirsin."
          onAction={() => router.push("/")}
          title="Sepetin boş"
        />
      ) : null}

      {authSession.status === "authenticated" && cart && (cart.items.length > 0 || cart.unavailableItems.length > 0) ? (
        <>
          <MobileCard style={styles.boundaryCard}>
            <Text style={styles.boundaryTitle}>Demo ödeme modu</Text>
            <Text style={styles.boundaryText}>{getMobileBasketDemoPaymentCopy()}</Text>
          </MobileCard>

          {cart.unavailableItems.length > 0 ? (
            <>
              <MobileCard style={styles.unavailableCard}>
                <Text style={styles.unavailableTitle}>Sepette uygun olmayan ilan var</Text>
                <Text style={styles.unavailableText}>
                  {getMobileBasketUnavailableItemsCopy(cart.unavailableItems.length)}
                </Text>
              </MobileCard>

              <View style={styles.list}>
                {cart.unavailableItems.map((item) => (
                  <CartItemCard
                    disabled={actionStatus === "pending"}
                    item={item}
                    key={item.id}
                    onOpen={() => router.push(`/listing/${encodeURIComponent(item.listingId)}`)}
                    onRemove={() => void handleRemove(item)}
                    unavailable
                  />
                ))}
              </View>
            </>
          ) : null}

          {cart.items.length > 0 ? <MobileSectionHeader title="Sepetteki aktif ilanlar" /> : null}
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

            {checkoutState.reason ? <Text style={styles.summaryHint}>{checkoutState.reason}</Text> : null}

            <MobileButton
              accessibilityLabel="Demo checkout işlemini tamamla"
              disabled={checkoutState.disabled}
              iconName="card-outline"
              onPress={() => void handleCheckout()}
            >
              {checkoutState.label}
            </MobileButton>
            <MobileButton
              accessibilityLabel="Sepeti temizle"
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

      {checkoutSuccessCopy ? (
        <MobileCard accessible accessibilityLabel="Demo checkout tamamlandı" style={styles.successCard}>
          <Text style={styles.successTitle}>{checkoutSuccessCopy.title}</Text>
          <Text style={styles.successText}>{checkoutSuccessCopy.body}</Text>
          <Text style={styles.successText}>{checkoutSuccessCopy.detail}</Text>
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
  onRemove,
  unavailable = false
}: {
  disabled: boolean;
  item: MobileCartItem;
  onOpen: () => void;
  onRemove: () => void;
  unavailable?: boolean;
}) {
  return (
    <MobileListingCard
      accessibilityLabel={`Sepet ilanını aç: ${item.title}`}
      actions={
        <>
          {!unavailable ? (
            <MobileButton
              accessibilityLabel={`Sepet ilan detayı: ${item.title}`}
              disabled={disabled}
              iconName="open-outline"
              onPress={onOpen}
              variant="secondary"
            >
              Detay
            </MobileButton>
          ) : null}
          <MobileButton
            accessibilityLabel={`Sepetten kaldır: ${item.title}`}
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
      locationText={unavailable ? "Artık uygun değil" : "Sepet"}
      priceText={item.priceText}
      title={item.title}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md
  },
  boundaryCard: {
    gap: spacing.xs,
    borderColor: colors.border
  },
  boundaryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  boundaryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  unavailableCard: {
    gap: spacing.xs,
    borderColor: "#f6dfb8"
  },
  unavailableTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  unavailableText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
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
