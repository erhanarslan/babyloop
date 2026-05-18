"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "../auth/api";
import { getAuthToken } from "../../lib/auth-client";
import { createOrGetConversation } from "./api";

type MessageSellerButtonProps = {
  apiBaseUrl: string;
  listingId: string;
  sellerProfileId: string;
};

export function MessageSellerButton({
  apiBaseUrl,
  listingId,
  sellerProfileId
}: MessageSellerButtonProps) {
  const router = useRouter();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      if (!getAuthToken()) {
        setIsLoadingUser(false);
        return;
      }

      try {
        const body = await fetchCurrentUser(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (body.ok) {
          setCurrentProfileId(body.data.profile.id);
        }
      } catch {
        if (isActive) {
          setMessage("BabyLoop API is unavailable.");
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
  }, [apiBaseUrl]);

  async function handleMessageSeller() {
    setIsPending(true);
    setMessage(null);

    try {
      const body = await createOrGetConversation(apiBaseUrl, listingId);

      if (!body.ok) {
        setMessage(body.error.message);
        return;
      }

      router.push(`/conversations/${body.data.conversation.id}`);
    } catch {
      setMessage("BabyLoop API is unavailable.");
    } finally {
      setIsPending(false);
    }
  }

  if (!getAuthToken()) {
    return (
      <div className="message-seller-action">
        <Link className="primary-link compact-link" href="/login">
          Login to message seller
        </Link>
      </div>
    );
  }

  if (isLoadingUser) {
    return (
      <div className="message-seller-action">
        <button className="secondary-button" disabled type="button">
          Checking seller
        </button>
      </div>
    );
  }

  if (currentProfileId === sellerProfileId) {
    return (
      <div className="message-seller-action">
        <button className="secondary-button" disabled type="button">
          This is your listing
        </button>
      </div>
    );
  }

  return (
    <div className="message-seller-action">
      <button
        className="submit-button"
        disabled={isPending}
        type="button"
        onClick={handleMessageSeller}
      >
        {isPending ? "Opening..." : "Message seller"}
      </button>
      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}
