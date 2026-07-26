import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/vault";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("The Paper Filter")).toBe("the-paper-filter");
  });
  it("strips punctuation and collapses separators", () => {
    expect(slugify("A Man & His Espresso!!")).toBe("a-man-his-espresso");
  });
  it("falls back to 'note' for empty input", () => {
    expect(slugify("!!!")).toBe("note");
  });
  it("caps length", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});
