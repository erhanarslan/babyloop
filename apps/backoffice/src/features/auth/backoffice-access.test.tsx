import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BackofficeAccessProvider,
  useBackofficeAccess
} from "./backoffice-access";

function AccessProbe() {
  const access = useBackofficeAccess();

  return (
    <div>
      <span>{access.accessMode}</span>
      {access.can("listing_view") ? <span>listing-read</span> : null}
      {access.can("profile_view") ? <span>profile-read</span> : null}
      {access.can("mutate") ? <button type="button">Mutate</button> : null}
    </div>
  );
}

describe("BackofficeAccessProvider", () => {
  it("keeps preview reads while removing mutation controls", () => {
    render(
      <BackofficeAccessProvider accessMode="preview" role="user">
        <AccessProbe />
      </BackofficeAccessProvider>
    );

    expect(screen.getByText("preview")).toBeVisible();
    expect(screen.getByText("listing-read")).toBeVisible();
    expect(screen.getByText("profile-read")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mutate" })).toBeNull();
  });

  it("keeps admin mutation controls unchanged", () => {
    render(
      <BackofficeAccessProvider accessMode="staff" role="admin">
        <AccessProbe />
      </BackofficeAccessProvider>
    );

    expect(screen.getByRole("button", { name: "Mutate" })).toBeVisible();
  });
});
