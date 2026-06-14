"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, EmptyState } from "../../components/ui";
import { fetchCurrentUser } from "../auth/api";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { recordProductEvent } from "../product-events/api";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { createOrGetConversation } from "./api";

type MessageSellerButtonProps = {
  apiBaseUrl: string;
  categoryId: string;
  listingId: string;
  sellerProfileId: string;
};

export function MessageSellerButton({
  apiBaseUrl,
  categoryId,
  listingId,
  sellerProfileId
}: MessageSellerButtonProps) {
  const { dictionary } = useI18n();
  const router = useRouter();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      if (!(await getOrRefreshAuthToken(apiBaseUrl))) {
        setIsAuthenticated(false);
        setIsLoadingUser(false);
        return;
      }

      try {
        const body = await fetchCurrentUser(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (body.ok) {
          setIsAuthenticated(true);
          setCurrentProfileId(body.data.profile.id);
        } else {
          setIsAuthenticated(false);
          setMessage(getApiErrorMessage(body.error, dictionary));
        }
      } catch {
        if (isActive) {
          setMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoadingUser(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary]);

  async function handleMessageSeller() {
    setIsPending(true);
    setMessage(null);

    void recordProductEvent(apiBaseUrl, {
      categoryId,
      eventType: "contact_seller_intent",
      listingId,
      source: "listing_detail"
    });

    try {
      const body = await createOrGetConversation(apiBaseUrl, listingId);

      if (!body.ok) {
        setMessage(getApiErrorMessage(body.error, dictionary));
        return;
      }

      router.push(`/conversations/${body.data.conversation.id}`);
    } catch {
      setMessage(dictionary.common.apiUnavailable);
    } finally {
      setIsPending(false);
    }
  }

  if (!isLoadingUser && isAuthenticated === false) {
    return (
      <div className="message-seller-action message-seller-action-polished">
        <div className="message-seller-guidance">
          <strong>Message inside BabyLoop</strong>
          <span>Sign in to ask item-specific questions without exposing private contact details.</span>
        </div>
        <Link className="primary-link compact-link" href="/login">
          {dictionary.messaging.loginToMessageSeller}
        </Link>
      </div>
    );
  }

  if (isLoadingUser) {
    return (
      <div className="message-seller-action message-seller-action-polished">
        <Button variant="secondary" disabled>
          {dictionary.messaging.checkingSeller}
        </Button>
      </div>
    );
  }

  if (currentProfileId === sellerProfileId) {
    return (
      <div className="message-seller-action message-seller-action-polished">
        <div className="message-seller-guidance">
          <strong>Your listing</strong>
          <span>Buyers can message you from this page while the listing is active or reserved.</span>
        </div>
        <Button variant="secondary" disabled>
          {dictionary.messaging.ownListing}
        </Button>
      </div>
    );
  }

  return (
    <div className="message-seller-action message-seller-action-polished">
      <div className="message-seller-guidance">
        <strong>Before messaging</strong>
        <span>Ask about condition, included parts, more photos, pickup timing, and whether the item is still available.</span>
      </div>
      <Button disabled={isPending} onClick={handleMessageSeller}>
        {isPending ? dictionary.messaging.opening : dictionary.messaging.messageSeller}
      </Button>
      {message ? <EmptyState title={dictionary.messaging.messagingUnavailable} message={message} /> : null}
    </div>
  );
}
