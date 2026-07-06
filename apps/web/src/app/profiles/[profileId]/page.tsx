import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  PageContainer,
  SiteShell
} from "../../../components/ui";
import { fetchApi } from "../../../lib/api";
import { buildNoIndexMetadata } from "../../../lib/seo";
import type { PublicSellerProfileSummary } from "../../../features/profiles/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildNoIndexMetadata(
  "Satıcı profili",
  "BabyLoop satıcı profili güvenli özet sayfası."
);

type PublicProfilePageProps = {
  params: Promise<{
    profileId: string;
  }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { profileId } = await params;
  const result = await fetchApi<{ profile: PublicSellerProfileSummary }>(`/api/v1/profiles/${profileId}`);

  if (!result.ok) {
    if (result.error.code === "PROFILE_NOT_FOUND" || result.error.code === "NOT_FOUND") {
      notFound();
    }
  }

  const profile = result.ok ? result.data.profile : null;

  return (
    <SiteShell>
      <PageContainer className="py-8" ariaLabel="Satıcı profili">
        {profile ? (
          <Card className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Satıcı</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">{profile.displayName}</h1>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {profile.locationCity ?? "Konum belirtilmedi"}
                </p>
              </div>
              <Badge>{formatSafetyStatus(profile.safetyStatus)}</Badge>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3">
              <ProfileFact label="Aktif ilan" value={profile.activeListingCount} />
              <ProfileFact label="Satılan ilan" value={profile.soldListingCount} />
              <ProfileFact label="Üyelik" value={formatDate(profile.memberSince)} />
            </dl>
          </Card>
        ) : (
          <Card>
            <h1 className="text-2xl font-black text-foreground">Satıcı profili yüklenemedi</h1>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Bu profil şu anda görüntülenemiyor.
            </p>
          </Card>
        )}
      </PageContainer>
    </SiteShell>
  );
}

function ProfileFact({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <dt className="text-xs font-black text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-black text-foreground">{value}</dd>
    </div>
  );
}

function formatSafetyStatus(status: PublicSellerProfileSummary["safetyStatus"]): string {
  if (status === "restricted") {
    return "Kısıtlı";
  }

  if (status === "suspended") {
    return "Askıda";
  }

  return "Aktif";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}
