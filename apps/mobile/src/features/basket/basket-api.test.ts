import {
  canCheckoutMobileCart,
  getMobileBasketCheckoutState,
  getMobileBasketCheckoutSuccessCopy,
  getMobileBasketDemoPaymentCopy,
  getMobileBasketUnavailableItemsCopy,
  normalizeCart,
  normalizeCheckout
} from "./basket-model";

describe("mobile basket API model", () => {
  it("normalizes cart items and subtotal", () => {
    const cart = normalizeCart({
      cart: {
        items: [
          {
            id: "cart-1",
            listing: {
              id: "listing-1",
              title: "Bebek arabası",
              price: { amount: "5800.00", currency: "TRY" },
              status: "active",
              listingType: "sale",
              condition: "good",
              firstImage: { url: "/uploads/stroller.png" }
            }
          }
        ],
        unavailableItems: [],
        subtotal: { amount: "5800.00", currency: "TRY" }
      }
    });

    expect(cart).toMatchObject({
      subtotalText: "5.800 TL",
      items: [
        {
          listingId: "listing-1",
          title: "Bebek arabası",
          priceText: "5.800 TL",
          statusText: "Aktif",
          listingTypeText: "Satılık",
          conditionText: "İyi"
        }
      ]
    });
  });

  it("normalizes mock checkout identifiers without exposing payment data", () => {
    expect(
      normalizeCheckout({
        checkout: {
          orderId: "order-1",
          mockIyzicoPaymentId: "mock-iyzico-1",
          paidAmount: "1000.00",
          currency: "TRY",
          items: [{ listingId: "listing-1" }]
        }
      })
    ).toEqual({
      orderId: "order-1",
      paymentId: "mock-iyzico-1",
      paidAmountText: "1.000 TL",
      itemCount: 1
    });
  });

  it("builds checkout UX state for demo payment boundaries", () => {
    const emptyCart = {
      items: [],
      unavailableItems: [],
      subtotalText: "0 TL"
    };

    const readyCart = {
      items: [
        {
          id: "cart-1",
          listingId: "listing-1",
          title: "Bebek arabası",
          priceText: "5.800 TL",
          imageUrl: null,
          status: "active",
          statusText: "Aktif",
          listingType: "sale",
          listingTypeText: "Satılık",
          conditionText: "İyi"
        }
      ],
      unavailableItems: [],
      subtotalText: "5.800 TL"
    };

    const blockedCart = {
      ...readyCart,
      unavailableItems: [
        {
          ...readyCart.items[0],
          id: "cart-2",
          listingId: "listing-2",
          status: "sold",
          statusText: "Satıldı"
        }
      ]
    };

    expect(canCheckoutMobileCart(emptyCart)).toBe(false);
    expect(canCheckoutMobileCart(readyCart)).toBe(true);
    expect(canCheckoutMobileCart(blockedCart)).toBe(false);

    expect(getMobileBasketCheckoutState(emptyCart, "idle")).toMatchObject({
      disabled: true,
      label: "Sepet boş"
    });

    expect(getMobileBasketCheckoutState(readyCart, "idle")).toMatchObject({
      disabled: false,
      label: "Demo checkout’u tamamla"
    });

    expect(getMobileBasketCheckoutState(blockedCart, "idle")).toMatchObject({
      disabled: true,
      label: "Önce uygun olmayanları kaldır"
    });

    expect(getMobileBasketCheckoutState(readyCart, "pending")).toMatchObject({
      disabled: true,
      label: "Ödeme simüle ediliyor..."
    });

    expect(getMobileBasketDemoPaymentCopy()).toContain("Gerçek kart bilgisi alınmaz");
    expect(getMobileBasketUnavailableItemsCopy(2)).toContain("2 ilan");
  });

  it("builds safe checkout success copy without exposing provider internals", () => {
    const copy = getMobileBasketCheckoutSuccessCopy({
      itemCount: 1,
      orderId: "order-1",
      paidAmountText: "1.000 TL"
    });

    expect(copy).toEqual({
      title: "Demo checkout tamamlandı",
      body: "1 ilan için ödeme simülasyonu tamamlandı. Gerçek para tahsil edilmedi.",
      detail: "Sipariş: order-1 · Tutar: 1.000 TL"
    });

    expect(JSON.stringify(copy)).not.toMatch(/providerPaymentId|card|token|secret/iu);
  });
});
