import { describe, expect, it } from "vitest";
import { chunkDocument } from "./chunking";
import { validateCitations } from "./citations";
import { generateGrounded } from "./llm";
import { INSUFFICIENT_EVIDENCE } from "./constants";
import { embedOne } from "./hashing";
import { parseUpload } from "./parser";

describe("chunking", () => {
  it("preserves headings", () => {
    const text = `# Title\n\n${"paragraph one. ".repeat(80)}\n\n## Details\n\n${"offset 312 ns. ".repeat(80)}`;
    const chunks = chunkDocument(text, 400, 40);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].ordinal).toBe(0);
    expect(chunks.some((chunk) => chunk.section === "Details")).toBe(true);
  });

  it("returns nothing for empty documents", () => {
    expect(chunkDocument("   ")).toEqual([]);
  });
});

describe("parser", () => {
  it("rejects empty files and pdfs", () => {
    expect(() => parseUpload({ filename: "a.md", text: "   " })).toThrow(/empty/i);
    expect(() => parseUpload({ filename: "a.pdf", text: "%PDF" })).toThrow(/Unsupported/);
  });
});

describe("embeddings", () => {
  it("are stable and normalized", () => {
    const first = embedOne("timing synchronization B-104");
    const second = embedOne("timing synchronization B-104");
    expect(first).toEqual(second);
    const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(Math.abs(norm - 1)).toBeLessThan(1e-6);
  });
});

describe("citations and LLM fallback", () => {
  it("drops unknown citation ids", () => {
    const evidence = [
      {
        chunk_id: "doc-1::c0000",
        document_id: "doc-1",
        title: "Failure report",
        content: "Mean clock offset 312 ns.",
        component: "Timing Synchronization",
        version: "B-104",
        combined_score: 0.8,
      },
    ];
    const citations = validateCitations(["doc-1::c0000", "invented", "doc-1::c0000"], evidence);
    expect(citations.map((item) => item.chunk_id)).toEqual(["doc-1::c0000"]);
  });

  it("labels insufficient evidence when nothing is retrieved", () => {
    const result = generateGrounded("Why did timing fail?", []);
    expect(result.evidence_coverage).toBe("insufficient");
    expect(result.answer).toBe(INSUFFICIENT_EVIDENCE);
  });
});
