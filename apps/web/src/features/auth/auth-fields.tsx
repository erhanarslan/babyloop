import type { AuthMode } from "./api";

type AuthFieldsProps = {
  mode: AuthMode;
};

export function AuthFields({ mode }: AuthFieldsProps) {
  const isRegister = mode === "register";

  return (
    <div className="form-grid">
      <label className="form-field form-field-wide">
        <span>Email</span>
        <input name="email" type="email" maxLength={320} required />
      </label>

      <label className="form-field form-field-wide">
        <span>Password</span>
        <input name="password" type="password" minLength={8} maxLength={128} required />
      </label>

      {isRegister ? (
        <>
          <label className="form-field form-field-wide">
            <span>Display name</span>
            <input name="displayName" type="text" minLength={2} maxLength={120} required />
          </label>
          <label className="form-field form-field-wide">
            <span>City</span>
            <input name="locationCity" type="text" maxLength={120} />
          </label>
        </>
      ) : null}
    </div>
  );
}

