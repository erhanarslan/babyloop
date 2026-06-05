"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AuthLinkNoteProps = {
  kind: "alreadyRegistered" | "forgotPassword" | "noAccount" | "rememberedPassword" | "verified";
};

export function AuthLinkNote({ kind }: AuthLinkNoteProps) {
  const { dictionary } = useI18n();

  if (kind === "noAccount") {
    return (
      <p className="form-note">
        {dictionary.auth.noAccount} <Link href="/register">{dictionary.auth.createOne}</Link>
      </p>
    );
  }

  if (kind === "alreadyRegistered") {
    return (
      <p className="form-note">
        {dictionary.auth.alreadyRegistered} <Link href="/login">{dictionary.common.login}</Link>
      </p>
    );
  }

  if (kind === "forgotPassword") {
    return (
      <p className="form-note">
        {dictionary.auth.forgotPassword}{" "}
        <Link href="/forgot-password">{dictionary.auth.requestReset}</Link>
      </p>
    );
  }

  if (kind === "verified") {
    return (
      <p className="form-note">
        <Link href="/login">{dictionary.common.backToLogin}</Link>
      </p>
    );
  }

  return (
    <p className="form-note">
      <Link href="/login">{dictionary.common.backToLogin}</Link>
    </p>
  );
}
