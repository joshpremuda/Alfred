import { describe, it, expect } from "vitest";
import { ftsQuery, topKByVector } from "@/lib/retrieval";
import { vecToBlob } from "@/lib/vector";

describe("ftsQuery", () => {
  it("builds a prefix OR query from tokens", () => {
    expect(ftsQuery("golf yardage")).toBe('"golf"* OR "yardage"*');
  });
  it("strips punctuation and short tokens", () => {
    expect(ftsQuery("a, coffee!!")).toBe('"coffee"*');
  });
  it("is empty for punctuation-only input", () => {
    expect(ftsQuery("!!! ??")).toBe("");
  });
});

describe("topKByVector", () => {
  const row = (item_id: number, content: string, vec: number[]) => ({
    item_id,
    title: `Item ${item_id}`,
    url: null,
    content,
    vec: vecToBlob(Float32Array.from(vec)),
  });

  it("ranks rows by cosine similarity to the query", () => {
    const rows = [
      row(1, "golf", [1, 0, 0]),
      row(2, "coffee", [0, 1, 0]),
      row(3, "church", [0, 0, 1]),
    ];
    const hits = topKByVector(Float32Array.from([0.9, 0.1, 0]), rows, 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].content).toBe("golf");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });
});
