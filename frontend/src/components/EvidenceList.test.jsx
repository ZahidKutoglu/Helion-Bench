import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EvidenceList } from "./EvidenceList";

describe("EvidenceList", () => {
  it("shows an empty state when there are no citations", () => {
    render(<EvidenceList citations={[]} />);
    expect(screen.getByText("No validated citations.")).toBeInTheDocument();
  });

  it("links each citation to the source document and shows the excerpt", () => {
    render(
      <MemoryRouter>
        <EvidenceList
          citations={[
            {
              chunk_id: "SYN-FAIL-TS-B104::c0001",
              document_id: "SYN-FAIL-TS-B104",
              title: "Failure report TS-4410",
              excerpt: "FAILED. Timing synchronization test TS-4410 did not meet HWL-TS-REQ-12.",
              component: "Timing Synchronization",
              version: "B-104",
              combined_score: 0.38,
            },
          ]}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Failure report TS-4410" });
    expect(link).toHaveAttribute("href", "/documents/SYN-FAIL-TS-B104");
    expect(screen.getByText(/did not meet HWL-TS-REQ-12/)).toBeInTheDocument();
    expect(screen.getByText(/SYN-FAIL-TS-B104::c0001/)).toBeInTheDocument();
  });
});
