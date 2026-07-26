import { describe, it, expect } from "vitest";
import { cosine, vecToBlob, blobToVec } from "@/lib/vector";

describe("cosine", () => {
  it("is 1 for identical direction", () => {
    expect(cosine(Float32Array.from([1, 0, 0]), Float32Array.from([2, 0, 0]))).toBeCloseTo(1);
  });
  it("is 0 for orthogonal vectors", () => {
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([0, 1]))).toBeCloseTo(0);
  });
  it("ranks a closer vector higher", () => {
    const q = Float32Array.from([0.9, 0.1, 0]);
    const golf = cosine(q, Float32Array.from([1, 0, 0]));
    const other = cosine(q, Float32Array.from([0, 0, 1]));
    expect(golf).toBeGreaterThan(other);
  });
  it("returns 0 when a vector is all zeros", () => {
    expect(cosine(Float32Array.from([0, 0]), Float32Array.from([1, 1]))).toBe(0);
  });
});

describe("blob round-trip", () => {
  it("preserves the vector exactly", () => {
    const v = Float32Array.from([1, -0.5, 3.25, 0]);
    expect(Array.from(blobToVec(vecToBlob(v)))).toEqual([1, -0.5, 3.25, 0]);
  });
  it("handles an offset buffer (simulating better-sqlite3)", () => {
    const v = Float32Array.from([0.1, 0.2, 0.3]);
    const wide = Buffer.concat([Buffer.from([0, 0]), vecToBlob(v)]);
    const sliced = wide.subarray(2); // non-zero byteOffset
    const out = blobToVec(sliced);
    expect(out[0]).toBeCloseTo(0.1);
    expect(out[2]).toBeCloseTo(0.3);
  });
});
