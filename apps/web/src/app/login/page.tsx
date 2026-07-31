import { redirect } from "next/navigation";
import { buildLegacyAuthRedirect } from "../../features/auth/auth-modal-query";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const incoming = await searchParams;
  redirect(buildLegacyAuthRedirect("login", incoming));
}
