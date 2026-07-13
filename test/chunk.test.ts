import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/chunk";

describe("chunkText", () => {
  it("returns [] for empty/whitespace", () => {
    expect(chunkText("   \n ")).toEqual([]);
  });
  it("returns a single chunk when short", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });
  it("collapses whitespace", () => {
    expect(chunkText("a   b\n\nc")).toEqual(["a b c"]);
  });
  it("splits long text into overlapping windows", () => {
    const text = "x".repeat(2500);
    const chunks = chunkText(text, 1000, 150);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].length).toBe(1000);
    // full text is covered
    expect(chunks.join("").length).toBeGreaterThanOrEqual(2500);
  });
});
