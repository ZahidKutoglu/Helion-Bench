import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeBasePage } from "./KnowledgeBasePage";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    getCatalog: vi.fn().mockResolvedValue({
      components: ["Timing Synchronization"],
      document_types: ["failure_report"],
      versions: ["B-104"],
    }),
    searchKnowledge: vi.fn(),
  };
});

import { searchKnowledge } from "../lib/api";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("KnowledgeBasePage", () => {
  it("keeps an empty prompt until a search runs", async () => {
    renderPage();
    expect(await screen.findByText(/Nothing is hardcoded/)).toBeInTheDocument();
  });

  it("renders live hits after search", async () => {
    searchKnowledge.mockResolvedValueOnce({
      hits: [
        {
          chunk_id: "SYN-FAIL-TS-B104::c0001",
          document_id: "SYN-FAIL-TS-B104",
          title: "Failure report TS-4410",
          content: "FAILED. Timing synchronization test TS-4410 did not meet HWL-TS-REQ-12.",
          component: "Timing Synchronization",
          document_type: "failure_report",
          version: "B-104",
          combined_score: 0.38,
          vector_score: 0.2,
          lexical_score: 0.5,
        },
      ],
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("link", { name: "Failure report TS-4410" })).toHaveAttribute(
      "href",
      "/documents/SYN-FAIL-TS-B104",
    );
    expect(screen.getByText(/did not meet HWL-TS-REQ-12/)).toBeInTheDocument();
    expect(searchKnowledge).toHaveBeenCalled();
  });

  it("shows an error when search fails", async () => {
    searchKnowledge.mockRejectedValueOnce(new Error("Qdrant is unavailable"));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Qdrant is unavailable")).toBeInTheDocument();
  });

  it("shows a no-results state", async () => {
    searchKnowledge.mockResolvedValueOnce({ hits: [] });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText(/No indexed chunks matched/)).toBeInTheDocument();
  });

  it("shows a searching label while the request is in flight", async () => {
    let resolveSearch;
    searchKnowledge.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("button", { name: "Searching…" })).toBeDisabled();
    resolveSearch({ hits: [] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeEnabled());
  });
});
