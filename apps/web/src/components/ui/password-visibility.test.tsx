import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextInput } from "./form-controls";

describe("TextInput password visibility", () => {
  it("shows an eye while hidden and a crossed eye while visible", () => {
    render(
      <TextInput
        autoComplete="current-password"
        label="Şifre"
        name="password"
        type="password"
      />
    );

    const input = screen.getByLabelText("Şifre", { selector: "input" });
    const showButton = screen.getByRole("button", { name: "Şifreyi göster" });

    expect(input).toHaveAttribute("type", "password");
    expect(showButton).toHaveAttribute("data-password-visibility-icon", "eye");
    expect(showButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(showButton);

    const hideButton = screen.getByRole("button", { name: "Şifreyi gizle" });

    expect(input).toHaveAttribute("type", "text");
    expect(hideButton).toHaveAttribute("data-password-visibility-icon", "eye-off");
    expect(hideButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hideButton);

    expect(input).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Şifreyi göster" })
    ).toHaveAttribute("data-password-visibility-icon", "eye");
  });

  it("keeps the visibility control disabled with a disabled password input", () => {
    render(
      <TextInput
        disabled
        label="Devre dışı şifre"
        name="disabledPassword"
        type="password"
      />
    );

    expect(
      screen.getByRole("button", { name: "Şifreyi göster" })
    ).toBeDisabled();
  });
});
