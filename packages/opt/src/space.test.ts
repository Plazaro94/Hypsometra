import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countGridSize, enumerateGrid, expandParam } from "./space.js";

describe("parameter space", () => {
  it("expands int ranges inclusively", () => {
    assert.deepEqual(
      expandParam({ name: "n", kind: "int", from: 1, to: 5, step: 2 }),
      [1, 3, 5],
    );
  });

  it("builds a cartesian grid", () => {
    const grid = enumerateGrid([
      { name: "a", kind: "int", from: 1, to: 2, step: 1 },
      { name: "b", kind: "enum", values: ["x", "y"] },
    ]);
    assert.equal(countGridSize([
      { name: "a", kind: "int", from: 1, to: 2, step: 1 },
      { name: "b", kind: "enum", values: ["x", "y"] },
    ]), 4);
    assert.equal(grid.length, 4);
    assert.deepEqual(grid[0], { a: 1, b: "x" });
  });
});
