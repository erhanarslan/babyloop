import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { SiteHeader } from "../../components/site-header";
import { getApiBaseUrl } from "../../lib/api";

export default function RegisterPage() {
  return (
    <main>
      <SiteHeader />

      <section className="section page-heading">
        <p className="eyebrow">Account</p>
        <h1>Create account</h1>
        <p>Create a local BabyLoop user and linked marketplace profile.</p>
      </section>

      <section className="section auth-layout" aria-label="Register form">
        <div className="form-panel auth-panel">
          <AuthForm apiBaseUrl={getApiBaseUrl()} mode="register" />
          <p className="form-note">
            Already registered? <Link href="/login">Login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
