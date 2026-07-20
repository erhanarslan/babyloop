import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { addCartItemBodySchema, mockIyzicoCheckoutBodySchema } from "../schemas/cart.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  addCartItem,
  checkoutCartWithMockIyzico,
  clearCart,
  getCartForCurrentUser,
  getCartSummaryForCurrentUser,
  removeCartItem,
  type CartResponse,
  type CartSummaryResponse,
  type MockCheckoutResponse
} from "../services/cart.service.js";
import { trackServerAnalyticsEvent } from "../services/product-analytics.service.js";

type CartApiResponse = ApiResponse<{ cart: CartResponse }>;
type CartSummaryApiResponse = ApiResponse<{ summary: CartSummaryResponse }>;
type CheckoutApiResponse = ApiResponse<{ checkout: MockCheckoutResponse }>;

export function registerCartRoutes(app: FastifyInstance): void {
  app.get<{ Reply: CartApiResponse | ApiFailure }>("/cart", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        cart: await getCartForCurrentUser(app, currentUser)
      }
    };
  });

  app.get<{ Reply: CartSummaryApiResponse | ApiFailure }>("/cart/summary", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        summary: await getCartSummaryForCurrentUser(app, currentUser)
      }
    };
  });

  app.post<{ Body: unknown; Reply: CartApiResponse | ApiFailure }>("/cart/items", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedBody = addCartItemBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send(invalidCartRequest("Cart item body is invalid."));
    }

    const result = await addCartItem(app, currentUser, parsedBody.data.listingId);

    if (result.status === "not_found") {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "LISTING_NOT_FOUND",
          message: "Listing was not found."
        }
      });
    }

    if (result.status === "own_listing") {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "CANNOT_ADD_OWN_LISTING_TO_CART",
          message: "You cannot add your own listing to cart."
        }
      });
    }

    if (result.status === "listing_unavailable") {
      return reply.status(409).send({
        ok: false,
        error: {
          code: "LISTING_UNAVAILABLE_FOR_CART",
          message: "Only active listings can be added to cart."
        }
      });
    }

    if (result.status === "added" || result.status === "already_exists") {
      if (result.status === "added") {
        void trackServerAnalyticsEvent(app, {
          eventName: "cart_item_added",
          platform: "web",
          profileId: currentUser.profile.id,
          properties: {
            listingId: parsedBody.data.listingId,
            sourceSurface: "server_cart"
          },
          sessionId: currentUser.sessionId,
          userId: currentUser.userId
        });
      }

      return {
        ok: true,
        data: {
          cart: result.cart
        }
      };
    }

    return reply.status(500).send({
      ok: false,
      error: {
        code: "CART_OPERATION_FAILED",
        message: "Cart operation failed."
      }
    });
  });

  app.delete<{ Params: { listingId: string }; Reply: CartApiResponse | ApiFailure }>(
    "/cart/items/:listingId",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = addCartItemBodySchema.safeParse({ listingId: request.params.listingId });

      if (!parsedBody.success) {
        return reply.status(400).send(invalidCartRequest("Listing id must be a valid UUID."));
      }

      const cart = await removeCartItem(app, currentUser, parsedBody.data.listingId);
      void trackServerAnalyticsEvent(app, {
        eventName: "cart_item_removed",
        platform: "web",
        profileId: currentUser.profile.id,
        properties: {
          listingId: parsedBody.data.listingId,
          sourceSurface: "server_cart"
        },
        sessionId: currentUser.sessionId,
        userId: currentUser.userId
      });

      return {
        ok: true,
        data: {
          cart
        }
      };
    }
  );

  app.delete<{ Reply: CartApiResponse | ApiFailure }>("/cart", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        cart: await clearCart(app, currentUser)
      }
    };
  });

  app.post<{ Body: unknown; Reply: CheckoutApiResponse | CartApiResponse | ApiFailure }>(
    "/checkout/mock-iyzico",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = mockIyzicoCheckoutBodySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send(invalidCartRequest("Checkout body is invalid."));
      }

      const result = await checkoutCartWithMockIyzico(app, currentUser, parsedBody.data.scenario);

      if (result.status === "empty_cart") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "CART_EMPTY",
            message: "Your cart is empty."
          }
        });
      }

      if (result.status === "listing_unavailable") {
        return reply.status(409).send({
          ok: false,
          error: {
            code: "CART_LISTING_UNAVAILABLE",
            message: "One or more listings are no longer available."
          }
        });
      }

      if (result.status === "unsupported_listing_type") {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "CHECKOUT_DONATION_LISTINGS_NOT_SUPPORTED",
            message: "Demo checkout cannot be used for donation listings."
          }
        });
      }

      if (result.status === "payment_failed") {
        void trackServerAnalyticsEvent(app, {
          eventName: "checkout_failed",
          platform: "web",
          profileId: currentUser.profile.id,
          properties: {
            providerMode: "mock",
            reasonBucket: "mock_payment_failed"
          },
          sessionId: currentUser.sessionId,
          userId: currentUser.userId
        });
        return reply.status(402).send({
          ok: false,
          error: {
            code: "MOCK_IYZICO_PAYMENT_FAILED",
            message: "Demo checkout failed. Your cart was not changed."
          }
        });
      }

      if (result.status === "paid") {
        void trackServerAnalyticsEvent(app, {
          eventName: "checkout_completed",
          platform: "web",
          profileId: currentUser.profile.id,
          properties: {
            providerMode: "mock"
          },
          sessionId: currentUser.sessionId,
          userId: currentUser.userId
        });
        return {
          ok: true,
          data: {
            checkout: result.checkout
          }
        };
      }

      return reply.status(500).send({
        ok: false,
        error: {
          code: "CHECKOUT_OPERATION_FAILED",
          message: "Checkout operation failed."
        }
      });
    }
  );
}

function invalidCartRequest(message: string): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CART_REQUEST",
      message
    }
  };
}
