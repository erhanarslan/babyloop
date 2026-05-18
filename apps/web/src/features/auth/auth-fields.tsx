import { TextInput } from "../../components/ui";
import type { AuthMode } from "./api";

type AuthFieldsProps = {
  mode: AuthMode;
};

export function AuthFields({ mode }: AuthFieldsProps) {
  const isRegister = mode === "register";

  return (
    <div className="form-grid">
      <TextInput label="Email" name="email" type="email" maxLength={320} required wide />

      <TextInput
        label="Password"
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
            label="Display name"
            name="displayName"
            type="text"
            minLength={2}
            maxLength={120}
            required
            wide
          />
          <TextInput label="City" name="locationCity" type="text" maxLength={120} wide />
        </>
      ) : null}
    </div>
  );
}
