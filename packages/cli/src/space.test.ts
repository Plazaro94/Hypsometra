import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseIntRange } from "./space.js";

describe("parseIntRange", () => {
  it("parses from:to:step", () => {
    assert.deepEqual(parseIntRange("3:5:1", "fast"), {
      name: "fast",
      kind: "int",
      from: 3,
      to: 5,
      step: 1,
    });
  });

  it("rejects bad specs", () => {
    assert.throws(() => parseIntRange("3:5", "fast"));
  });
});
