"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, LoadingBlock, PageContainer, PageHeading } from "../../components/ui";
import { getApiErrorMessage, type ApiError } from "../../lib/api-error-message";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import {
  checkoutWithMockIyzico,
  clearCart,
  fetchCart,
  removeCartItem,
  type CartPayload,
  type MockCheckoutPayload
} from "./api";
import {
  formatListingCondition,
  formatListingPrice,
  formatListingStatus,
  formatListingType
} from "../listings/listing-display";

type CartPageContentProps = {
  apiBaseUrl: string;
};

type CartState =
  | { status: "checking" | "loading" }
  | { status: "guest" }
  | { status: "error"; error: string }
  | { status: "ready"; cart: CartPayload["cart"] };

export function CartPageContent({ apiBaseUrl }: CartPageContentProps) {
  const { dictionary } = useI18n();
  const [state, setState] = useState<CartState>({ status: "checking" });
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [checkoutResult, setCheckoutResult] = useState<MockCheckoutPayload["checkout"] | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function loadCart() {
    setState({ status: "loading" });
    setCheckoutError(null);

    if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
      setState({ status: "guest" });
      return;
    }

    try {
      const body = await fetchCart(apiBaseUrl);

      if (!body.ok) {
        setState({ status: "error", error: getApiErrorMessage(body.error, dictionary) });
        return;
      }

      setState({ status: "ready", cart: body.data.cart });
    } catch {
      setState({ status: "error", error: "Sepet şu an yüklenemedi." });
    }
  }

  useEffect(() => {
    void loadCart();
  }, [apiBaseUrl]);

  async function handleRemove(listingId: string) {
    const body = await removeCartItem(apiBaseUrl, listingId);
    if (body.ok) {
      setState({ status: "ready", cart: body.data.cart });
    }
  }

  async function handleClearCart() {
    const body = await clearCart(apiBaseUrl);
    if (body.ok) {
      setState({ status: "ready", cart: body.data.cart });
      setCheckoutResult(null);
      setCheckoutStatus("idle");
    }
  }

  async function handleCheckout() {
    setCheckoutStatus("pending");
    setCheckoutError(null);
    setCheckoutResult(null);

    try {
      const body = await checkoutWithMockIyzico(apiBaseUrl, "success");

      if (!body.ok) {
        setCheckoutStatus("error");
        setCheckoutError(getApiErrorMessage(body.error as ApiError, dictionary));
        await loadCart();
        return;
      }

      setCheckoutStatus("success");
      setCheckoutResult(body.data.checkout);
      await loadCart();
    } catch {
      setCheckoutStatus("error");
      setCheckoutError("Mock iyzico ödeme akışı tamamlanamadı.");
    }
  }

  return (
    <PageContainer className="grid gap-5 pb-12 pt-5">
      <PageHeading
        eyebrow="Sepetim"
        title="Mock iyzico checkout"
        description="Bu demo akış gerçek kart bilgisi toplamaz; başarılı olduğunda ilan satıldı durumuna alınır."
      />

      {state.status === "checking" || state.status === "loading" ? (
        <LoadingBlock title="Sepet yükleniyor..." message="Cart içeriği hazırlanıyor." />
      ) : null}

      {state.status === "guest" ? (
        <EmptyState
          title="Sepetini görmek için giriş yap"
          message="Sepete eklediğin ilanlar ve mock checkout akışı burada görünür."
          actionHref="/login"
          actionLabel="Giriş yap"
        />
      ) : null}

      {state.status === "error" ? (
        <div className="grid gap-3">
          <Alert tone="error" title="Sepet yüklenemedi" message={state.error} />
          <Button className="w-fit" variant="secondary" onClick={() => void loadCart()}>
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        state.cart.items.length === 0 ? (
          <EmptyState
            title="Sepetin boş"
            message="Satılık aktif bir ilanı sepete ekleyerek demo checkout akışını deneyebilirsin."
            actionHref="/browse"
            actionLabel="İlanları keşfet"
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4">
              {state.cart.items.map((item) => (
                <CartItemCard
                  apiBaseUrl={apiBaseUrl}
                  item={item}
                  key={item.id}
                  onRemove={() => void handleRemove(item.listing.id)}
                />
              ))}
              {state.cart.unavailableItems.length > 0 ? (
                <Alert
                  tone="info"
                  title="Sepette uygun olmayan ilan var"
                  message="Bu ilanlar checkout toplamına dahil edilmedi."
                />
              ) : null}
            </div>

            <Card className="self-start">
              <h2 className="text-lg font-black text-foreground">Özet</h2>
              <dl className="mt-4 grid gap-2 text-sm font-bold text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>Ürün</dt>
                  <dd>{state.cart.items.length}</dd>
                </div>
                <div className="flex justify-between gap-4 text-foreground">
                  <dt>Ara toplam</dt>
                  <dd>{state.cart.subtotal.amount} {state.cart.subtotal.currency}</dd>
                </div>
              </dl>

              <div className="mt-5 grid gap-3">
                <Button disabled={checkoutStatus === "pending"} onClick={() => void handleCheckout()}>
                  {checkoutStatus === "pending" ? "Ödeme simüle ediliyor..." : "Mock iyzico ile öde"}
                </Button>
                <Button variant="secondary" onClick={() => void handleClearCart()}>
                  Sepeti temizle
                </Button>
              </div>

              {checkoutStatus === "error" && checkoutError ? (
                <p className="mt-3 text-sm font-bold text-destructive">{checkoutError}</p>
              ) : null}
            </Card>
          </div>
        )
      ) : null}

      {checkoutStatus === "success" && checkoutResult ? (
        <div data-testid="cart-success-card">
          <Alert
            tone="info"
            title="Mock ödeme başarılı"
            message={`Order ID: ${checkoutResult.orderId} · Payment ID: ${checkoutResult.mockIyzicoPaymentId} · Ödenen tutar: ${checkoutResult.paidAmount} ${checkoutResult.currency}`}
          />
        </div>
      ) : null}
    </PageContainer>
  );
}

function CartItemCard({
  apiBaseUrl,
  item,
  onRemove
}: {
  apiBaseUrl: string;
  item: CartPayload["cart"]["items"][number];
  onRemove: () => void;
}) {
  const { dictionary } = useI18n();
  const imageUrl = getSafeCartImageUrl(item.listing.firstImage?.url ?? item.listing.images[0]?.url ?? null, apiBaseUrl);

  return (
    <article data-cart-listing-id={item.listing.id} className="listing-card grid gap-4 overflow-hidden p-3 sm:grid-cols-[156px_minmax(0,1fr)]">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/30 to-secondary/40">
        {imageUrl ? <img alt="" className="h-full w-full object-cover" src={imageUrl} /> : (
          <span className="text-sm font-black text-primary">Görsel yok</span>
        )}
      </div>
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone={item.listing.status === "active" ? "success" : "neutral"}>
            {formatListingStatus(item.listing.status, dictionary)}
          </Badge>
          <Badge>{formatListingType(item.listing.listingType, dictionary)}</Badge>
          <Badge>{formatListingCondition(item.listing.condition, dictionary)}</Badge>
        </div>
        <div>
          <h2 className="line-clamp-2 text-lg font-black text-foreground">{item.listing.title}</h2>
          <p className="mt-2 text-xl font-black text-foreground">
            {formatListingPrice(item.listing.price, dictionary)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="primary-link" href={`/listings/${item.listing.id}`}>
            Detaya git
          </Link>
          <Button variant="ghost" onClick={onRemove}>
            Kaldır
          </Button>
        </div>
      </div>
    </article>
  );
}

function getSafeCartImageUrl(imageUrl: string | null | undefined, apiBaseUrl: string): string | null {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return imageUrl.startsWith("/") ? `${apiBaseUrl.replace(/\/$/, "")}${imageUrl}` : null;
}
