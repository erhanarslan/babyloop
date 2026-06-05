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
    <div className="form-grid">
      <TextInput label={dictionary.common.email} name="email" type="email" maxLength={320} required wide />

      <TextInput
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
            label={dictionary.common.displayName}
            name="displayName"
            type="text"
            minLength={2}
            maxLength={120}
            required
            wide
          />
          <TextInput label={dictionary.common.city} name="locationCity" type="text" maxLength={120} wide />
        </>
      ) : null}
    </div>
  );
}
