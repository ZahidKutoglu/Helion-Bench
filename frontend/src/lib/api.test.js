import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessage, formatPercent, getDocuments, searchKnowledge } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("errorMessage", () => {
  it("reads the API error envelope", () => {
    expect(errorMessage({ error: { message: "Qdrant is unavailable" } })).toBe("Qdrant is unavailable");
  });

  it("falls back when the body is empty", () => {
    expect(errorMessage(null, "Upload failed")).toBe("Upload failed");
  });
});

describe("request helpers", () => {
  it("throws with the server message when a request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: { message: "Qdrant is unavailable" } }),
      }),
    );
    await expect(searchKnowledge({ query: "timing", k: 8 })).rejects.toThrow("Qdrant is unavailable");
  });

  it("returns parsed JSON on success and forwards AbortSignal", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], total: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await getDocuments({ q: "TS-4410", status: "indexed" }, { signal });
    expect(data.total).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/documents?q=TS-4410&status=indexed",
      expect.objectContaining({ signal }),
    );
  });
});

describe("formatPercent", () => {
  it("renders one decimal place", () => {
    expect(formatPercent(0.867)).toBe("86.7%");
  });
});
