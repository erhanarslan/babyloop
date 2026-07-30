import { TextInput } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";
import type { AuthMode } from "./api";

type AuthFieldsProps = {
  mode: AuthMode;
};

export function AuthFields({ mode }: AuthFieldsProps) {
  const { dictionary } = useI18n();
  const isRegister = mode === "register";

  return (
    <div className="auth-fields-stack">
      <div className="form-grid">
        <TextInput
          autoComplete="email"
          label={dictionary.common.email}
          name="email"
          type="email"
          maxLength={320}
          required
          wide
        />

        <TextInput
          autoComplete={isRegister ? "new-password" : "current-password"}
          label={dictionary.common.password}
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          required
          wide
        />

        {isRegister ? (
          <>
            <TextInput
              autoComplete="name"
              label={dictionary.common.displayName}
              name="displayName"
              type="text"
              minLength={2}
              maxLength={120}
              required
            />
            <TextInput
              autoComplete="address-level2"
              label={dictionary.common.city}
              maxLength={120}
              name="locationCity"
              placeholder={dictionary.auth.locationPlaceholder}
              type="text"
            />
          </>
        ) : null}
      </div>

      {!isRegister ? (
        <div className="auth-field-guidance">
          <strong>{dictionary.authPageShell.login.badge}</strong>
          <span>{dictionary.authPageShell.login.checks[0]}</span>
        </div>
      ) : null}
    </div>
  );
}
