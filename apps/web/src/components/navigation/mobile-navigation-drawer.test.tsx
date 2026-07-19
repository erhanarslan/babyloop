import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthMe } from "../../lib/auth-client";
import { dictionaries } from "../../lib/i18n/dictionaries";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock("../../features/auth/protected-action-link", () => ({
  ProtectedActionLink: ({
    children,
    href,
    onClick
  }: {
    children: ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  )
}));

const dictionary = dictionaries.tr;

function renderDrawer({
  currentAuth = null,
  isOpen = true,
  onClose = vi.fn(),
  onLogin = vi.fn(),
  onLocationChange = vi.fn(),
  onLogout = vi.fn()
}: {
  currentAuth?: AuthMe | null;
  isOpen?: boolean;
  onClose?: () => void;
  onLogin?: () => void;
  onLocationChange?: (city: string) => void;
  onLogout?: () => void;
} = {}) {
  render(
    <MobileNavigationDrawer
      apiBaseUrl="http://api.test"
      currentAuth={currentAuth}
      dictionary={dictionary}
      isOpen={isOpen}
      onClose={onClose}
      onLogin={onLogin}
      onLocationChange={onLocationChange}
      onLogout={onLogout}
      selectedCity="istanbul"
      theme="light"
      toggleTheme={vi.fn()}
    />
  );

  return { onClose, onLogin, onLocationChange, onLogout };
}

describe("MobileNavigationDrawer", () => {
  beforeEach(() => {
    document.documentElement.className = "";
  });

  it("renders login affordance for guests without account links", () => {
    renderDrawer();

    expect(screen.getAllByText(dictionary.common.login).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "TR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EN" })).not.toBeInTheDocument();
    expect(screen.queryByText(dictionary.publicShell.accountMenu.logout)).not.toBeInTheDocument();
  });

  it("renders authenticated account links and display name", () => {
    renderDrawer({
      currentAuth: {
        profile: {
          id: "profile-1",
          displayName: "Ayşe Demir",
          locationCity: "İstanbul"
        },
        user: {
          id: "user-1",
          email: "ayse@example.test",
          role: "user",
          emailVerifiedAt: null
        }
      }
    });

    expect(screen.getByText("Ayşe Demir")).toBeInTheDocument();
    expect(screen.getByText(dictionary.publicShell.accountMenu.logout)).toBeInTheDocument();
    expect(screen.queryByText("ayse@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();
  });

  it("opens login prompt from guest drawer", () => {
    const onLogin = vi.fn();
    renderDrawer({ onLogin });

    fireEvent.click(screen.getAllByRole("button", { name: dictionary.common.login })[0]!);

    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("closes on escape and backdrop click", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getAllByRole("button", { name: dictionary.publicShell.header.close })[0]!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps keyboard focus inside the open drawer and hides the closed drawer", () => {
    const { rerender } = render(
      <MobileNavigationDrawer
        apiBaseUrl="http://api.test"
        currentAuth={null}
        dictionary={dictionary}
        isOpen
        onClose={vi.fn()}
        onLogin={vi.fn()}
        onLocationChange={vi.fn()}
        onLogout={vi.fn()}
        selectedCity="istanbul"
        theme="light"
        toggleTheme={vi.fn()}
      />
    );
    const drawer = screen.getByRole("dialog", {
      name: dictionary.mobileNavigation.drawerLabel
    });

    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    expect(drawer).toHaveAttribute("aria-modal", "true");

    rerender(
      <MobileNavigationDrawer
        apiBaseUrl="http://api.test"
        currentAuth={null}
        dictionary={dictionary}
        isOpen={false}
        onClose={vi.fn()}
        onLogin={vi.fn()}
        onLocationChange={vi.fn()}
        onLogout={vi.fn()}
        selectedCity="istanbul"
        theme="light"
        toggleTheme={vi.fn()}
      />
    );

    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");
  });

  it("lets mobile users change the marketplace city", () => {
    const onLocationChange = vi.fn();
    renderDrawer({ onLocationChange });

    fireEvent.change(
      screen.getByRole("combobox", {
        name: dictionary.publicShell.header.locationAria
      }),
      { target: { value: "ankara" } }
    );

    expect(onLocationChange).toHaveBeenCalledWith("ankara");
  });
});
