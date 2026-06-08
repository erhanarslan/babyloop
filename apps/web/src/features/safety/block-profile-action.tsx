"use client";

import { useState } from "react";
import { Alert, Button } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { blockProfile, unblockProfile } from "./api";

type BlockProfileActionProps = {
  apiBaseUrl: string;
  initialBlocked: boolean;
  profileId: string;
  onBlockedChange?: (blocked: boolean) => void;
};

export function BlockProfileAction({
  apiBaseUrl,
  initialBlocked,
  onBlockedChange,
  profileId
}: BlockProfileActionProps) {
  const { dictionary } = useI18n();
  const [isBlocked, setIsBlocked] = useState(initialBlocked);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function handleClick() {
    setIsPending(true);
    setMessage(null);

    try {
      const response = isBlocked
        ? await unblockProfile(apiBaseUrl, profileId)
        : await blockProfile(apiBaseUrl, profileId);

      if (!response.ok) {
        setMessage({
          tone: "error",
          text: getApiErrorMessage(response.error, dictionary)
        });
        return;
      }

      const nextBlocked = !isBlocked;
      setIsBlocked(nextBlocked);
      onBlockedChange?.(nextBlocked);
      setMessage({
        tone: "info",
        text: nextBlocked ? dictionary.safety.userBlocked : dictionary.safety.userUnblocked
      });
    } catch {
      setMessage({
        tone: "error",
        text: dictionary.common.apiUnavailable
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="safety-action">
      <Button disabled={isPending} type="button" variant="secondary" onClick={handleClick}>
        {isPending
          ? dictionary.safety.updating
          : isBlocked
            ? dictionary.safety.unblockUser
            : dictionary.safety.blockUser}
      </Button>
      {message ? (
        <Alert
          tone={message.tone}
          title={message.tone === "info" ? dictionary.safety.actionComplete : dictionary.safety.actionFailed}
          message={message.text}
        />
      ) : null}
    </div>
  );
}
