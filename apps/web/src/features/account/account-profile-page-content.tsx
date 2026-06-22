"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, LoadingBlock, PageContainer } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import type { AuthMe } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";

type AccountProfilePageContentProps = {
  apiBaseUrl: string;
};

type AccountSectionId =
  | "profile"
  | "marketplace"
  | "seller"
  | "family"
  | "security"
  | "preferences";

type AccountMenuItem = {
  id: AccountSectionId;
  label: string;
  description: string;
};

type AccountLink = {
  description: string;
  href: string;
  label: string;
};

const accountMenuItems: AccountMenuItem[] = [
  {
    id: "profile",
    label: "Profil özeti",
    description: "Ad, şehir ve hesap güvenliği"
  },
  {
    id: "marketplace",
    label: "Pazar kısayolları",
    description: "Favoriler, mesajlar ve bildirimler"
  },
  {
    id: "seller",
    label: "Satıcı araçları",
    description: "İlan verme ve satış alanı"
  },
  {
    id: "family",
    label: "Aile ihtiyaçları",
    description: "Çocuğum, rehberler ve asistan"
  },
  {
    id: "security",
    label: "Güvenlik",
    description: "Şifre ve yakında gelecek korumalar"
  },
  {
    id: "preferences",
    label: "Tercihler",
    description: "Bildirim ve ödeme ayarları"
  }
];

const marketplaceLinks: AccountLink[] = [
  {
    href: "/favorites",
    label: "Favoriler",
    description: "Kaydettiğin ilanlara hızlıca dön."
  },
  {
    href: "/account/saved-searches",
    label: "Kayıtlı aramalar",
    description: "Takip ettiğin arama ve filtreleri yönet."
  },
  {
    href: "/conversations",
    label: "Mesajlar",
    description: "Alıcı ve satıcı konuşmalarını aç."
  },
  {
    href: "/notifications",
    label: "Bildirimler",
    description: "Mesaj ve ilan hareketlerini gör."
  }
];

const sellerLinks: AccountLink[] = [
  {
    href: "/sell",
    label: "İlan ver",
    description: "Yeni bir bebek veya çocuk ürünü listele."
  },
  {
    href: "/my-listings",
    label: "İlanlarım",
    description: "Yayındaki ve arşivdeki ilanlarını yönet."
  },
  {
    href: "/account/seller",
    label: "Satıcı paneli",
    description: "Satıcı akışını ve ilan durumlarını takip et."
  }
];

const familyLinks: AccountLink[] = [
  {
    href: "/account/children",
    label: "Çocuğum / ihtiyaçlar",
    description: "Çocuğuna ait temel bilgileri sade şekilde tut."
  },
  {
    href: "/guides",
    label: "Ebeveyn rehberleri",
    description: "Kısa ve sakin ebeveyn yanıtlarını keşfet."
  },
  {
    href: "/assistant",
    label: "Asistan",
    description: "BabyLoop Asistan’a kısa bir soru sor."
  }
];

export function AccountProfilePageContent({ apiBaseUrl }: AccountProfilePageContentProps) {
  const { dictionary } = useI18n();
  const [activeSectionId, setActiveSectionId] = useState<AccountSectionId>("profile");
  const [currentUser, setCurrentUser] = useState<AuthMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clearProtectedState = useCallback(() => {
    setCurrentUser(null);
    setErrorMessage(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadAccount() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchCurrentUser(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setErrorMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setCurrentUser(body.data);
      } catch {
        if (isActive) {
          setErrorMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, requireAuth]);

  const activeSection = useMemo(
    () => accountMenuItems.find((item) => item.id === activeSectionId) ?? accountMenuItems[0]!,
    [activeSectionId]
  );

  return (
    <PageContainer className="pb-16 pt-6 sm:pt-8" ariaLabel="Hesabım">
      <section className="mb-4 sm:mb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Hesabım
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground sm:text-base">
          Pazar kısayollarını, satıcı araçlarını ve güvenlik ayarlarını tek yerden yönet.
        </p>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(55,48,42,0.09)]">
        <div className="grid lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-border/70 bg-muted/25 p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <nav aria-label="Hesap bölümleri" className="flex gap-2 overflow-x-auto pb-3 lg:grid lg:overflow-visible lg:pb-0">
              {accountMenuItems.map((item) => {
                const isActive = item.id === activeSection.id;

                return (
                  <button
                    aria-pressed={isActive}
                    className={[
                      "min-w-[190px] rounded-2xl border p-3 text-left transition lg:min-w-0",
                      isActive
                        ? "border-primary/40 bg-background shadow-sm"
                        : "border-transparent bg-transparent hover:bg-background/75"
                    ].join(" ")}
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSectionId(item.id)}
                  >
                    <span
                      className={[
                        "block rounded-xl px-3 py-2 text-sm font-black",
                        isActive ? "bg-primary text-primary-foreground" : "text-foreground"
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                    <span className="mt-2 block px-3 text-xs font-bold leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <article className="grid content-start gap-5 p-5 sm:p-7 lg:p-9">
            {isCheckingAuth || isLoading ? (
              <LoadingBlock title="Hesap bilgileri yükleniyor" />
            ) : null}

            {errorMessage ? (
              <Alert title="Hesap bilgileri alınamadı" message={errorMessage} />
            ) : null}

            {!isCheckingAuth && !isLoading && !errorMessage ? (
              <AccountSectionPanel
                currentUser={currentUser}
                sectionId={activeSection.id}
                title={activeSection.label}
              />
            ) : null}
          </article>
        </div>
      </section>
    </PageContainer>
  );
}

function AccountSectionPanel({
  currentUser,
  sectionId,
  title
}: {
  currentUser: AuthMe | null;
  sectionId: AccountSectionId;
  title: string;
}) {
  if (sectionId === "profile") {
    return <ProfileSummary currentUser={currentUser} title={title} />;
  }

  if (sectionId === "marketplace") {
    return <LinkSection links={marketplaceLinks} title={title} />;
  }

  if (sectionId === "seller") {
    return <LinkSection links={sellerLinks} title={title} />;
  }

  if (sectionId === "family") {
    return <LinkSection links={familyLinks} title={title} />;
  }

  if (sectionId === "security") {
    return <SecuritySection title={title} />;
  }

  return <PreferencesSection title={title} />;
}

function ProfileSummary({
  currentUser,
  title
}: {
  currentUser: AuthMe | null;
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description="Hesabında görünen temel bilgileri burada görebilirsin."
      />

      <dl className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
          <dt className="text-sm font-black text-muted-foreground">Ad soyad</dt>
          <dd className="text-base font-black text-foreground">
            {currentUser?.profile.displayName || "Belirtilmedi"}
          </dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
          <dt className="text-sm font-black text-muted-foreground">Şehir</dt>
          <dd className="text-base font-bold text-foreground">
            {currentUser?.profile.locationCity || "Belirtilmedi"}
          </dd>
        </div>
      </dl>

      <div>
        <Link
          className="inline-flex rounded-full border border-border bg-background px-4 py-2.5 text-sm font-black text-foreground transition hover:bg-muted"
          href="/account/password"
        >
          Güvenlik ve şifre
        </Link>
      </div>
    </div>
  );
}

function LinkSection({
  links,
  title
}: {
  links: AccountLink[];
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description="Sık kullandığın alanlara hızlıca geç."
      />
      <div className="grid gap-3">
        {links.map((link) => (
          <Link
            className="grid gap-1 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
            href={link.href}
            key={link.href}
          >
            <span className="text-base font-black text-foreground">{link.label}</span>
            <span className="text-sm font-semibold leading-6 text-muted-foreground">
              {link.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SecuritySection({ title }: { title: string }) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description="Şifre alanı hazır; ek güvenlik seçenekleri geldiğinde buradan yönetilecek."
      />
      <div className="grid gap-3">
        <Link
          className="grid gap-1 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
          href="/account/password"
        >
          <span className="text-base font-black text-foreground">Güvenlik ve şifre</span>
          <span className="text-sm font-semibold leading-6 text-muted-foreground">
            Şifreni güncelle ve hesabını güvende tut.
          </span>
        </Link>
        <DisabledToggleRow
          description="Girişlerde ikinci doğrulama adımı."
          label="OTP / MFA"
        />
        <DisabledToggleRow
          description="Yeni girişleri mobil onayla doğrulama."
          label="Mobil onay"
        />
        <DisabledToggleRow
          description="Güvendiğin cihazları daha sonra burada görebileceksin."
          label="Güvenilir cihazlar"
        />
      </div>
    </div>
  );
}

function PreferencesSection({ title }: { title: string }) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description="Bildirim ve ödeme ayarları hazır olduğunda buradan açılacak."
      />
      <div className="grid gap-3">
        <Link
          className="grid gap-1 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
          href="/account/notification-preferences"
        >
          <span className="text-base font-black text-foreground">Bildirim tercihleri</span>
          <span className="text-sm font-semibold leading-6 text-muted-foreground">
            Çocuk profili, kayıtlı arama ve marketplace bildirimlerini yönet.
          </span>
        </Link>
        <DisabledPreferenceRow
          description="Ödeme araçları henüz BabyLoop içinde aktif değil."
          label="Ödeme araçları"
        />
      </div>
    </div>
  );
}

function SectionHeading({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function DisabledToggleRow({
  description,
  label
}: {
  description: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-black text-foreground">{label}</strong>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
            Yakında
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <button
        aria-label={`${label} yakında`}
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted opacity-70"
        disabled
        type="button"
      >
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-background shadow-sm" />
      </button>
    </div>
  );
}

function DisabledPreferenceRow({
  description,
  label
}: {
  description: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-black text-foreground">{label}</strong>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
            Yakında
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
