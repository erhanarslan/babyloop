import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { SiteHeader } from "../../components/site-header";
import { getApiBaseUrl } from "../../lib/api";

export default function LoginPage() {
  return (
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Account</p>
        <h1>Login</h1>
        <p>Use your BabyLoop account to create listings and save favorites.</p>
      </section>

      <section className="section auth-layout" aria-label="Login form">
        <div className="form-panel auth-panel">
          <AuthForm apiBaseUrl={getApiBaseUrl()} mode="login" />
          <p className="form-note">
            No account yet? <Link href="/register">Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
