"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, EmptyState } from "../../components/ui";
import { fetchCurrentUser } from "../auth/api";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
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
          setMessage(body.error.message);
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

  if (!isLoadingUser && isAuthenticated === false) {
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
        <Button variant="secondary" disabled>
          Checking seller
        </Button>
      </div>
    );
  }

  if (currentProfileId === sellerProfileId) {
    return (
      <div className="message-seller-action">
        <Button variant="secondary" disabled>
          This is your listing
        </Button>
      </div>
    );
  }

  return (
    <div className="message-seller-action">
      <Button disabled={isPending} onClick={handleMessageSeller}>
        {isPending ? "Opening..." : "Message seller"}
      </Button>
      {message ? <EmptyState title="Messaging unavailable" message={message} /> : null}
    </div>
  );
}
