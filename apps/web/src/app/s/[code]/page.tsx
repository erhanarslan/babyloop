import { notFound, redirect } from "next/navigation";
import { getApiBaseUrl } from "../../../lib/api";

type ShortLinkRedirectPageProps = {
  params: Promise<{
    code: string;
  }>;
};

type ResolveShortLinkResponse = {
  ok: boolean;
  data?: {
    targetPath?: string;
  };
};

export default async function ShortLinkRedirectPage({
  params
}: ShortLinkRedirectPageProps) {
  const { code } = await params;
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/share-links/${encodeURIComponent(code)}/resolve`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    notFound();
  }

  const payload = (await response.json().catch(() => null)) as ResolveShortLinkResponse | null;
  const targetPath = payload?.ok === true ? payload.data?.targetPath : null;

  if (!targetPath || !targetPath.startsWith("/listings/")) {
    notFound();
  }

  redirect(targetPath);
}
