import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner, StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the live status text", () => {
    render(<StatusBadge status="indexed" />);
    expect(screen.getByText("indexed")).toBeInTheDocument();
  });
});

describe("ErrorBanner", () => {
  it("is hidden without an error", () => {
    const { container } = render(<ErrorBanner error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the failure and retries when asked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBanner error={new Error("API unreachable")} onRetry={onRetry} />);
    expect(screen.getByText("API unreachable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
