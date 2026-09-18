import { describe, expect, it } from "vitest";
import { mergeById } from "./mergeById";

describe("mergeById", () => {
  it("updates existing records in place and appends new records", () => {
    expect(mergeById(
      [{ id: 1, value: "old" }, { id: 2, value: "keep" }],
      [{ id: 1, value: "new" }, { id: 3, value: "added" }],
    )).toEqual([
      { id: 1, value: "new" },
      { id: 2, value: "keep" },
      { id: 3, value: "added" },
    ]);
  });
});
