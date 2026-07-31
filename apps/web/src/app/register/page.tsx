import { redirect } from "next/navigation";
import { buildLegacyAuthRedirect } from "../../features/auth/auth-modal-query";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const incoming = await searchParams;
  redirect(buildLegacyAuthRedirect("register", incoming));
}
