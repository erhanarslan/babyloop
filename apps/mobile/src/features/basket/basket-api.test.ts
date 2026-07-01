import { normalizeCart, normalizeCheckout } from "./basket-model";

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
});
