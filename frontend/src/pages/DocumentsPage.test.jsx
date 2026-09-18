import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DocumentsPage } from "./DocumentsPage";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual("../lib/api");
  return {
    ...actual,
    getCatalog: vi.fn().mockResolvedValue({
      components: ["Timing Synchronization"],
      document_types: ["failure_report"],
      versions: ["B-104"],
    }),
    getDocuments: vi.fn(),
    uploadDocument: vi.fn(),
    reprocessDocument: vi.fn(),
    deleteDocument: vi.fn(),
  };
});

import { getDocuments, uploadDocument } from "../lib/api";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    getDocuments.mockResolvedValue({
      items: [
        {
          id: "SYN-FAIL-TS-B104",
          title: "Failure report TS-4410",
          status: "indexed",
          component: "Timing Synchronization",
          document_type: "failure_report",
          version: "B-104",
          chunk_count: 4,
          updated_at: "2026-09-18T05:12:28Z",
        },
      ],
      total: 1,
    });
  });

  it("loads documents from the API and keeps upload disabled until a file is chosen", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: "Failure report TS-4410" })).toHaveAttribute(
      "href",
      "/documents/SYN-FAIL-TS-B104",
    );
    expect(screen.getByRole("button", { name: "Upload and index" })).toBeDisabled();
  });

  it("uploads the selected file through the API", async () => {
    uploadDocument.mockResolvedValueOnce({
      id: "doc_uploaded",
      title: "Lab note",
      status: "indexed",
      chunk_count: 2,
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: "Failure report TS-4410" });
    const file = new File(["# note\nTiming offset 312 ns."], "note.md", { type: "text/plain" });
    const input = screen.getByLabelText("File");
    await user.upload(input, file);
    expect(screen.getByRole("button", { name: "Upload and index" })).toBeEnabled();
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(1));
    const form = uploadDocument.mock.calls[0][0];
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("file")).toBeInstanceOf(File);
    expect(await screen.findByText(/Indexed Lab note/)).toBeInTheDocument();
  });

  it("shows an API error instead of a silent failure", async () => {
    getDocuments.mockRejectedValueOnce(new Error("API unreachable"));
    renderPage();
    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
