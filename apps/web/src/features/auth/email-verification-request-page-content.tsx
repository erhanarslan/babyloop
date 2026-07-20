"use client";

import { Card, PageContainer } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { RequestEmailVerificationForm } from "./request-email-verification-form";

type EmailVerificationRequestPageContentProps = {
  apiBaseUrl: string;
};

export function EmailVerificationRequestPageContent({
  apiBaseUrl
}: EmailVerificationRequestPageContentProps) {
  const { dictionary } = useI18n();

  return (
    <PageContainer
      ariaLabel={dictionary.auth.requestVerifyTitle}
      className="email-verification-request-page"
    >
      <Card
        as="section"
        aria-labelledby="email-verification-request-title"
        className="email-verification-request-card"
      >
        <div className="email-verification-request-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 7.5 12 13l8-5.5" />
            <path d="M5.5 19h13A1.5 1.5 0 0 0 20 17.5v-11A1.5 1.5 0 0 0 18.5 5h-13A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19Z" />
            <path d="m15.5 15.5 1.4 1.4 2.8-3" />
          </svg>
        </div>

        <header className="email-verification-request-heading">
          <p className="eyebrow">{dictionary.auth.requestVerificationEyebrow}</p>
          <h1 id="email-verification-request-title">
            {dictionary.auth.requestVerifyTitle}
          </h1>
          <p>{dictionary.auth.requestVerifyDescription}</p>
        </header>

        <RequestEmailVerificationForm apiBaseUrl={apiBaseUrl} />

        <p className="email-verification-request-note">
          {dictionary.auth.verificationLinkSafetyNote}
        </p>
      </Card>
    </PageContainer>
  );
}
