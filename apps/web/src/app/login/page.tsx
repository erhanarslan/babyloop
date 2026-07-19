import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const incoming = await searchParams;
  const params = new URLSearchParams({ auth: "login" });

  for (const key of ["error", "passwordChanged", "returnTo"] as const) {
    const value = incoming?.[key];
    const firstValue = Array.isArray(value) ? value[0] : value;

    if (firstValue) {
      params.set(key, firstValue);
    }
  }

  redirect(`/?${params.toString()}`);
}
