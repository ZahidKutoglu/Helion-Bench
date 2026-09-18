import { afterEach, describe, expect, it } from "vitest";
import { errorMessage, formatPercent, getDocuments, searchKnowledge } from "./api";
import { __resetStoreForTests } from "../engine/store";

afterEach(() => {
  __resetStoreForTests();
});

describe("errorMessage", () => {
  it("reads the API error envelope", () => {
    expect(errorMessage({ error: { message: "Index is empty" } })).toBe("Index is empty");
  });

  it("falls back when the body is empty", () => {
    expect(errorMessage(null, "Upload failed")).toBe("Upload failed");
  });
});

describe("local knowledge store", () => {
  it("seeds synthetic documents and searches them", async () => {
    const listed = await getDocuments({ q: "TS-4410" });
    expect(listed.total).toBeGreaterThan(0);
    const search = await searchKnowledge({
      query: "Why did timing synchronization fail in build B-104?",
      k: 8,
    });
    expect(search.hits.length).toBeGreaterThan(0);
    expect(search.hits.some((hit) => hit.document_id === "SYN-FAIL-TS-B104")).toBe(true);
  });
});

describe("formatPercent", () => {
  it("renders one decimal place", () => {
    expect(formatPercent(0.867)).toBe("86.7%");
  });
});
