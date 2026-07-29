import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoListingBadge } from "./demo-listing-badge";

describe("DemoListingBadge", () => {
  it("renders an explicit accessible label for demo listings", () => {
    render(<DemoListingBadge isDemo />);
    expect(screen.getByLabelText("Demo ilan")).toHaveTextContent("Demo ilan");
  });

  it("does not render for normal listings", () => {
    const { container } = render(<DemoListingBadge isDemo={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
