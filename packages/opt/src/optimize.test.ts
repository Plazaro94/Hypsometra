import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSmaCrossStrategy,
  type BacktestConfig,
  type Bar,
} from "@hypsometra/engine";
import { optimize } from "./optimize.js";
import type { ParamMap } from "./types.js";

function synthBars(n: number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  const start = Date.parse("2024-01-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    // Gentle uptrend with a mid dip — enough structure for SMA cross
    const wave = Math.sin(i / 5) * 3;
    const drift = i * 0.15;
    price = 100 + drift + wave;
    const open = price;
    const close = price + (i % 3 === 0 ? -0.5 : 0.8);
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    bars.push({
      time: start + i * 86_400_000,
      open,
      high,
      low,
      close,
      volume: 1000,
    });
  }
  return bars;
}

const config: BacktestConfig = {
  conflictResolution: "stop",
  account: { initialBalance: 10_000, currency: "USD" },
  symbol: {
    name: "TEST",
    point: 1,
    tickValue: 1,
    spread: 0,
    commissionPerTrade: 0,
  },
};

describe("optimize", () => {
  it("grid-finds SMA periods and returns a ranked best", () => {
    const bars = synthBars(80);
    const result = optimize({
      bars,
      config,
      mode: "grid",
      criterion: "netProfit",
      space: [
        { name: "fast", kind: "int", from: 3, to: 5, step: 1 },
        { name: "slow", kind: "int", from: 8, to: 12, step: 2 },
      ],
      createStrategy: (params: ParamMap) =>
        createSmaCrossStrategy({
          fastPeriod: Number(params["fast"]),
          slowPeriod: Number(params["slow"]),
        }),
    });

    assert.equal(result.mode, "grid");
    assert.ok(result.evaluated >= 6);
    assert.equal(result.passes.length, result.evaluated);
    assert.ok(result.best.score === result.passes[0]!.score);
    assert.ok(Number(result.best.params["fast"])! < Number(result.best.params["slow"])!);
  });

  it("genetic mode evaluates a bounded population", () => {
    const bars = synthBars(80);
    const result = optimize({
      bars,
      config,
      mode: "genetic",
      criterion: "netProfit",
      space: [
        { name: "fast", kind: "int", from: 2, to: 8, step: 1 },
        { name: "slow", kind: "int", from: 10, to: 20, step: 1 },
      ],
      createStrategy: (params: ParamMap) =>
        createSmaCrossStrategy({
          fastPeriod: Number(params["fast"]),
          slowPeriod: Number(params["slow"]),
        }),
      genetic: { population: 12, generations: 5, seed: 7 },
    });

    assert.equal(result.mode, "genetic");
    assert.ok(result.evaluated >= 12);
    assert.ok(result.evaluated < 2 * 7 * 11); // far below full grid
    assert.ok(Number.isFinite(result.best.score));
  });
});
