import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveIntrabarExit } from "../broker/execution.js";
import type { Bar } from "../types.js";

const bar = (partial: Partial<Bar> & Pick<Bar, "open" | "high" | "low" | "close">): Bar => ({
  time: 0,
  volume: 0,
  ...partial,
});

describe("resolveIntrabarExit", () => {
  it("hits stop for a long when low pierces SL", () => {
    const hit = resolveIntrabarExit(
      "long",
      bar({ open: 100, high: 101, low: 95, close: 96 }),
      97,
      110,
      "stop",
    );
    assert.equal(hit, "sl");
  });

  it("prefers stop when both SL and TP are touchable", () => {
    const hit = resolveIntrabarExit(
      "long",
      bar({ open: 100, high: 120, low: 80, close: 100 }),
      90,
      110,
      "stop",
    );
    assert.equal(hit, "sl");
  });

  it("can prefer target when configured", () => {
    const hit = resolveIntrabarExit(
      "long",
      bar({ open: 100, high: 120, low: 80, close: 100 }),
      90,
      110,
      "target",
    );
    assert.equal(hit, "tp");
  });
});
