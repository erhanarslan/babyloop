"use client";

import { LoadingBlock } from "../../components/ui";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AuthLoadingKind = "callback" | "reset" | "verify";

const loadingCopyKeys = {
  callback: ["callbackTitle", "callbackDescription"],
  reset: ["resetTitle", "resetDescription"],
  verify: ["verifyingEmail", "verifyingEmailBody"]
} as const satisfies Record<AuthLoadingKind, readonly [keyof Dictionary["auth"], keyof Dictionary["auth"]]>;

export function AuthLoadingBlock({ kind }: { kind: AuthLoadingKind }) {
  const { dictionary } = useI18n();
  const [titleKey, messageKey] = loadingCopyKeys[kind];

  return (
    <LoadingBlock
      title={dictionary.auth[titleKey]}
      message={dictionary.auth[messageKey]}
    />
  );
}
